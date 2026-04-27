import { Hono } from "hono";
import { getCachedVerdict, putCachedVerdict } from "./cache";
import { classifyWithClaude } from "./claude";
import { runHeuristics } from "./heuristics";
import { normalizeUrl } from "./heuristics/normalize";
import type { AnalyzeResponse, AnalyzeUrlRequest } from "./types";

interface Env {
  ANTHROPIC_API_KEY: string;
  VERDICT_CACHE: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

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

export default app;
