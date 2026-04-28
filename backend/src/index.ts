import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { getCachedVerdict, putCachedVerdict } from "./cache";
import { classifyWithClaude } from "./claude";
import { streamExplanation, validateExplainRequest } from "./explain";
import { runHeuristics } from "./heuristics";
import { normalizeUrl } from "./heuristics/normalize";
import type { AnalyzeResponse, AnalyzeUrlRequest } from "./types";

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
  const cacheKey = `${normalized.host}${normalized.url.pathname}`;

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

// Streaming educational explanation. SSE; see explain.ts for shape.
app.post("/explain/url", async (c) => {
  const raw = await c.req.json().catch(() => null);
  const body = validateExplainRequest(raw);
  if (!body) {
    return c.json({ error: "Required: { url, verdict, confidence, reasons[] }" }, 400);
  }
  return streamSSE(c, (stream) =>
    streamExplanation(stream, c.env.ANTHROPIC_API_KEY, body),
  );
});

export default app;
