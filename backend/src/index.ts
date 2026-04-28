import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import {
  cacheKeyForEmail,
  cacheKeyForUrl,
  getCachedVerdict,
  putCachedVerdict,
} from "./cache";
import { classifyWithClaude } from "./claude";
import { classifyEmailWithClaude } from "./email-claude";
import {
  buildEmailUserMessage as buildExplainEmailUserMessage,
  FALLBACK_TEXT_EMAIL,
  SYSTEM_PROMPT_EMAIL,
  validateExplainEmailRequest,
} from "./email-explain";
import { runEmailHeuristics } from "./email-heuristics";
import {
  buildUserMessage as buildExplainUrlUserMessage,
  FALLBACK_TEXT,
  streamExplanation,
  SYSTEM_PROMPT,
  validateExplainRequest,
} from "./explain";
import { runHeuristics } from "./heuristics";
import { normalizeUrl } from "./heuristics/normalize";
import type {
  AnalyzeEmailRequest,
  AnalyzeResponse,
  AnalyzeUrlRequest,
} from "./types";

interface Env {
  ANTHROPIC_API_KEY: string;
  VERDICT_CACHE: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for extension pages (the side panel) talking to this backend.
// The extension's background worker bypasses CORS via host_permissions,
// but extension pages still go through normal browser CORS. Reflect any
// chrome-extension origin since the dev/prod IDs differ.
app.use(
  "*",
  cors({
    origin: (origin) =>
      origin && origin.startsWith("chrome-extension://") ? origin : "",
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/", (c) => c.text("WhyShield backend OK"));

app.post("/analyze/url", async (c) => {
  let body: AnalyzeUrlRequest;
  try {
    body = (await c.req.json()) as AnalyzeUrlRequest;
  } catch {
    return c.json({ error: "Body must be JSON: { url: string }" }, 400);
  }
  if (!body || typeof body.url !== "string" || body.url.length === 0) {
    return c.json({ error: "Field `url` is required and must be a non-empty string." }, 400);
  }

  const normalized = normalizeUrl(body.url);
  if (!normalized) {
    const resp: AnalyzeResponse = {
      verdict: "suspicious",
      confidence: 0.5,
      reasons: [],
      explanation:
        "We couldn't read this address as a normal web link. If you didn't expect it, it's worth a closer look.",
    };
    return c.json(resp);
  }

  // Cache key is host + path so trivial query-string variants of the same
  // page share a cache entry, but different paths on the same host don't.
  const cacheKey = await cacheKeyForUrl(`${normalized.host}${normalized.url.pathname}`);

  const cached = await getCachedVerdict(c.env.VERDICT_CACHE, cacheKey);
  if (cached) return c.json(cached);

  const heur = runHeuristics(normalized);
  if (heur.conclusive && heur.response) {
    await putCachedVerdict(c.env.VERDICT_CACHE, cacheKey, heur.response);
    return c.json(heur.response);
  }

  const claudeVerdict = await classifyWithClaude({
    url: normalized.raw,
    host: normalized.host,
    heuristicHints: heur.inconclusiveReasons,
    apiKey: c.env.ANTHROPIC_API_KEY,
  });
  await putCachedVerdict(c.env.VERDICT_CACHE, cacheKey, claudeVerdict);
  return c.json(claudeVerdict);
});

app.post("/analyze/email", async (c) => {
  let body: AnalyzeEmailRequest;
  try {
    body = (await c.req.json()) as AnalyzeEmailRequest;
  } catch {
    return c.json({ error: "Body must be JSON" }, 400);
  }
  const validationError = validateAnalyzeEmail(body);
  if (validationError) return c.json({ error: validationError }, 400);

  const cacheKey = await cacheKeyForEmail(body);

  const cached = await getCachedVerdict(c.env.VERDICT_CACHE, cacheKey);
  if (cached) return c.json(cached);

  const heur = runEmailHeuristics(body);
  if (heur.conclusive && heur.response) {
    await putCachedVerdict(c.env.VERDICT_CACHE, cacheKey, heur.response);
    return c.json(heur.response);
  }

  const claudeVerdict = await classifyEmailWithClaude({
    request: body,
    heuristicHints: heur.inconclusiveReasons,
    apiKey: c.env.ANTHROPIC_API_KEY,
  });
  await putCachedVerdict(c.env.VERDICT_CACHE, cacheKey, claudeVerdict);
  return c.json(claudeVerdict);
});

// Streaming educational explanation. SSE; see explain.ts for shape.
app.post("/explain/url", async (c) => {
  const raw = await c.req.json().catch(() => null);
  const body = validateExplainRequest(raw);
  if (!body) {
    return c.json({ error: "Required: { url, verdict, confidence, reasons[] }" }, 400);
  }
  return streamSSE(c, (stream) =>
    streamExplanation(stream, c.env.ANTHROPIC_API_KEY, {
      system: SYSTEM_PROMPT,
      user: buildExplainUrlUserMessage(body),
      fallback: FALLBACK_TEXT,
    }),
  );
});

app.post("/explain/email", async (c) => {
  const raw = await c.req.json().catch(() => null);
  const body = validateExplainEmailRequest(raw);
  if (!body) {
    return c.json(
      { error: "Required: { from, subject, body, links[], verdict, confidence, reasons[] }" },
      400,
    );
  }
  return streamSSE(c, (stream) =>
    streamExplanation(stream, c.env.ANTHROPIC_API_KEY, {
      system: SYSTEM_PROMPT_EMAIL,
      user: buildExplainEmailUserMessage(body),
      fallback: FALLBACK_TEXT_EMAIL,
    }),
  );
});

// Inline validator for /analyze/email — small enough that a separate
// module would be overkill. Returns an error string or null.
function validateAnalyzeEmail(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  const b = body as Record<string, unknown>;
  if (typeof b.from !== "string" || b.from.length === 0) {
    return "Field `from` is required and must be a non-empty string.";
  }
  if (b.replyTo !== undefined && typeof b.replyTo !== "string") {
    return "Field `replyTo` must be a string when present.";
  }
  if (typeof b.subject !== "string") return "Field `subject` is required (string).";
  if (typeof b.body !== "string") return "Field `body` is required (string).";
  if (!Array.isArray(b.links)) return "Field `links` is required (string[]).";
  for (const link of b.links) {
    if (typeof link !== "string") return "Field `links` must contain only strings.";
  }
  if (
    b.headerHints !== undefined &&
    (typeof b.headerHints !== "object" || b.headerHints === null)
  ) {
    return "Field `headerHints` must be an object when present.";
  }
  return null;
}

export default app;
