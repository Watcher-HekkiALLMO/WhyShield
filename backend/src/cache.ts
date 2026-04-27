import type { AnalyzeResponse } from "./types";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// SHA-256 hex digest using the Web Crypto API (available globally in
// Cloudflare Workers).
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function cacheKeyForUrl(normalizedUrl: string): Promise<string> {
  return `url:${await sha256Hex(normalizedUrl)}`;
}

export async function getCachedVerdict(
  kv: KVNamespace,
  normalizedUrl: string,
): Promise<AnalyzeResponse | null> {
  const key = await cacheKeyForUrl(normalizedUrl);
  const raw = await kv.get(key, "json");
  return (raw as AnalyzeResponse | null) ?? null;
}

export async function putCachedVerdict(
  kv: KVNamespace,
  normalizedUrl: string,
  verdict: AnalyzeResponse,
): Promise<void> {
  const key = await cacheKeyForUrl(normalizedUrl);
  await kv.put(key, JSON.stringify(verdict), { expirationTtl: CACHE_TTL_SECONDS });
}
