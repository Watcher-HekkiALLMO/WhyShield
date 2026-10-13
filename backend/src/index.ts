import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { cacheKeyForEmail, cacheKeyForUrl, getCachedVerdict, putCachedVerdict } from "./cache";
import { classifyWithClaude } from "./claude";
import { classifyEmailWithClaude } from "./email-claude";
import {
  FALLBACK_TEXT_EMAIL,
  SYSTEM_PROMPT_EMAIL,
  buildEmailUserMessage as buildExplainEmailUserMessage,
  validateExplainEmailRequest,
} from "./email-explain";
import { runEmailHeuristics } from "./email-heuristics";
import {
  FALLBACK_TEXT,
  SYSTEM_PROMPT,
  buildUserMessage as buildExplainUrlUserMessage,
  openExplanation,
  pumpExplanation,
  validateExplainRequest,
} from "./explain";
import { runHeuristics } from "./heuristics";
import { normalizeUrl } from "./heuristics/normalize";
import {
  ANALYZE_LIMIT_PER_HOUR,
  EXPLAIN_LIMIT_PER_HOUR,
  INSTALL_HEADER,
  rateLimit,
} from "./rate-limit";
import type { AnalyzeEmailRequest, AnalyzeResponse, AnalyzeUrlRequest } from "./types";

interface Env {
  ANTHROPIC_API_KEY: string;
  VERDICT_CACHE: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// Bring-your-own-key. If the extension sends this header, the request's
// Claude calls bill the user's own Anthropic account instead of ours.
// The value is read once here and handed straight to the SDK client. It
// is never logged, never cached, and never written to KV. If request
// logging is ever added to this file, this header must be excluded.
const API_KEY_HEADER = "X-WhyShield-API-Key";

interface ResolvedKey {
  apiKey: string;
  // true when the key came from the header, so a 401 from Anthropic is
  // the user's problem to fix rather than ours.
  byok: boolean;
}

function apiKeyFor(c: Context<{ Bindings: Env }>): ResolvedKey {
  const own = c.req.header(API_KEY_HEADER)?.trim();
  return own ? { apiKey: own, byok: true } : { apiKey: c.env.ANTHROPIC_API_KEY, byok: false };
}

// A rejected user key must surface, not fail open. The extension looks
// for exactly this status + body (see extension/src/shared/backend.ts)
// and shows a notice on the options page. We deliberately do NOT retry
// with the shared key: that would bill us for a user's broken key and
// hide the problem from them.
const BYOK_REJECTED_BODY = { error: "byok-rejected" } as const;

// 401 = key not recognized (mistyped). 403 = key recognized but not
// allowed (disabled, or restricted from this model). Both mean the user
// has to fix their key, so both get the same notice. A 400 for an empty
// credit balance is deliberately NOT here: the key is fine, the account
// isn't, and that needs different wording when we add it.
function isAnthropicAuthError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const status = (e as { status?: unknown }).status;
  return status === 401 || status === 403;
}

// CORS for extension pages (the side panel) talking to this backend.
// The extension's background worker bypasses CORS via host_permissions,
// but extension pages still go through normal browser CORS. Reflect any
// chrome-extension origin since the dev/prod IDs differ.
app.use(
  "*",
  cors({
    origin: (origin) => (origin && origin.startsWith("chrome-extension://") ? origin : ""),
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type", API_KEY_HEADER, INSTALL_HEADER],
  }),
);

// Per-install rate limits, applied after CORS (so preflights are never
// counted) and before any route. Explain is tighter because each call
// is a Sonnet stream, roughly 10x the cost of a Haiku verdict, and a
// human can't read 50 explanations an hour anyway.
app.use("/analyze/*", rateLimit<{ Bindings: Env }>("analyze", ANALYZE_LIMIT_PER_HOUR));
app.use("/explain/*", rateLimit<{ Bindings: Env }>("explain", EXPLAIN_LIMIT_PER_HOUR));

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

  const key = apiKeyFor(c);
  let claudeVerdict: AnalyzeResponse;
  try {
    claudeVerdict = await classifyWithClaude({
      url: normalized.raw,
      host: normalized.host,
      heuristicHints: heur.inconclusiveReasons,
      apiKey: key.apiKey,
    });
  } catch (e) {
    if (key.byok && isAnthropicAuthError(e)) return c.json(BYOK_REJECTED_BODY, 401);
    throw e;
  }
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

  const key = apiKeyFor(c);
  let claudeVerdict: AnalyzeResponse;
  try {
    claudeVerdict = await classifyEmailWithClaude({
      request: body,
      heuristicHints: heur.inconclusiveReasons,
      apiKey: key.apiKey,
    });
  } catch (e) {
    if (key.byok && isAnthropicAuthError(e)) return c.json(BYOK_REJECTED_BODY, 401);
    throw e;
  }
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
  // Open the model stream before streamSSE commits a 200, so a rejected
  // user key can still be answered with 401. See openExplanation.
  const key = apiKeyFor(c);
  const opened = await openExplanation(key.apiKey, {
    system: SYSTEM_PROMPT,
    user: buildExplainUrlUserMessage(body),
  });
  if (!opened.ok && key.byok && isAnthropicAuthError(opened.error)) {
    return c.json(BYOK_REJECTED_BODY, 401);
  }
  return streamSSE(c, (stream) => pumpExplanation(stream, opened, FALLBACK_TEXT));
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
  const key = apiKeyFor(c);
  const opened = await openExplanation(key.apiKey, {
    system: SYSTEM_PROMPT_EMAIL,
    user: buildExplainEmailUserMessage(body),
  });
  if (!opened.ok && key.byok && isAnthropicAuthError(opened.error)) {
    return c.json(BYOK_REJECTED_BODY, 401);
  }
  return streamSSE(c, (stream) => pumpExplanation(stream, opened, FALLBACK_TEXT_EMAIL));
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
