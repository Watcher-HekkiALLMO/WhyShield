import type { AnalyzeEmailRequest, AnalyzeResponse } from "./types";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// SHA-256 hex digest using the Web Crypto API (available globally in
// Cloudflare Workers).
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Build a cache key for a normalized URL. Prefixes with "url:" so URL
// and email entries can never collide in the shared KV namespace.
export async function cacheKeyForUrl(normalizedUrl: string): Promise<string> {
  return `url:${await sha256Hex(normalizedUrl)}`;
}

// Build a cache key for an email request. Hash inputs: from, subject,
// body, and the *sorted* link list — sorting matters so the same template
// with the links rearranged still hits the same cache entry, while a
// genuinely different link set (a phisher swapping in a new domain after
// their old one got flagged) produces a different key.
export async function cacheKeyForEmail(email: AnalyzeEmailRequest): Promise<string> {
  const sortedLinks = [...email.links].sort().join("\n");
  const input = [email.from, email.subject, email.body, sortedLinks].join("\n---\n");
  return `email:${await sha256Hex(input)}`;
}

export async function getCachedVerdict(
  kv: KVNamespace,
  cacheKey: string,
): Promise<AnalyzeResponse | null> {
  const raw = await kv.get(cacheKey, "json");
  return (raw as AnalyzeResponse | null) ?? null;
}

export async function putCachedVerdict(
  kv: KVNamespace,
  cacheKey: string,
  verdict: AnalyzeResponse,
): Promise<void> {
  await kv.put(cacheKey, JSON.stringify(verdict), { expirationTtl: CACHE_TTL_SECONDS });
}
