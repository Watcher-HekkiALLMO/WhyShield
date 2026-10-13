import type { MiddlewareHandler } from "hono";

// Per-install rate limiting. Protects the shared Anthropic key from one
// client (buggy, malicious, or just a tight loop) draining the budget
// for everyone. The extension generates a random UUID once per install
// and sends it on every request; nothing about it identifies a person.

export const INSTALL_HEADER = "X-WhyShield-Install";

export const ANALYZE_LIMIT_PER_HOUR = 200;
export const EXPLAIN_LIMIT_PER_HOUR = 50;

// Each route family has its own budget, so the key carries a scope.
// Without it, 200 analyze calls would also exhaust the 50 explain calls.
export type RateLimitScope = "analyze" | "explain";

// Counters live in the same KV namespace as the verdict cache. A bucket
// is one UTC clock hour; TTL is 2h so a bucket outlives its hour by a
// margin and then disappears on its own. No cleanup job needed.
export const RATE_LIMIT_TTL_SECONDS = 2 * 60 * 60;

// The id becomes part of a KV key (512-byte cap), so we insist on a
// safe charset and bounded length rather than trusting the header. A
// UUID is 36 chars; anything in this shape is fine.
const INSTALL_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function isValidInstallId(s: string | undefined): s is string {
  return typeof s === "string" && INSTALL_ID_PATTERN.test(s);
}

// UTC yyyymmddhh. UTC so every edge computes the same bucket for the
// same instant regardless of where the worker runs.
export function hourBucket(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}` +
    `${pad(now.getUTCMonth() + 1)}` +
    `${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}`
  );
}

export function rateLimitKey(scope: RateLimitScope, installId: string, now: Date): string {
  return `rl:${scope}:${installId}:${hourBucket(now)}`;
}

export type RateLimitResult = { allowed: true; count: number } | { allowed: false };

// Two layers, because neither alone is enough:
//
//   KV     survives across isolates and locations, but reads are served
//          from a per-location cache that can be up to 60s stale and
//          there is no atomic increment. A burst of 200 requests from
//          one place can read "3" the whole time and never trip.
//   Memory lives inside this worker isolate only, but updates instantly.
//          Bursts from one location land on the same isolate, so it
//          catches exactly the case KV misses.
//
// The effective count is the max of the two. Exact enforcement would
// need a Durable Object; this is deliberately the cheaper approximation
// (noted in CLAUDE.md as a v2 item). Any KV failure fails OPEN: a
// storage blip should never block a user from getting a verdict.
export type MemoryCounts = Map<string, number>;

// ~200 bytes per entry, so this is about 2 MB worst case per isolate.
// Far more distinct installs than one isolate sees in an hour.
export const MEMORY_MAX_ENTRIES = 10_000;

const defaultMemory: MemoryCounts = new Map();
let defaultMemoryBucket = "";

// Drop every entry when the hour rolls over, so memory can't grow
// without bound across a long-lived isolate.
function memoryFor(now: Date): MemoryCounts {
  const bucket = hourBucket(now);
  if (bucket !== defaultMemoryBucket) {
    defaultMemory.clear();
    defaultMemoryBucket = bucket;
  }
  return defaultMemory;
}

export async function consumeQuota(
  kv: KVNamespace,
  scope: RateLimitScope,
  installId: string,
  limit: number,
  now: Date = new Date(),
  memory: MemoryCounts = memoryFor(now),
): Promise<RateLimitResult> {
  const key = rateLimitKey(scope, installId, now);

  // A KV read failure degrades to memory-only counting rather than
  // switching the limiter off: same-isolate bursts are still caught.
  let stored = 0;
  try {
    const raw = await kv.get(key);
    stored = raw ? Number.parseInt(raw, 10) || 0 : 0;
  } catch {
    stored = 0;
  }

  const count = Math.max(stored, memory.get(key) ?? 0);
  if (count >= limit) return { allowed: false };

  const next = count + 1;
  // The id is client-chosen, so a client rotating ids could grow the map
  // one entry per request. Cap it; past the cap we simply stop adding
  // new entries (existing ones keep counting) until the hour rolls over.
  if (memory.has(key) || memory.size < MEMORY_MAX_ENTRIES) memory.set(key, next);
  try {
    await kv.put(key, String(next), { expirationTtl: RATE_LIMIT_TTL_SECONDS });
  } catch {
    // Fail open. Memory still advanced, so bursts are still caught.
  }
  return { allowed: true, count: next };
}

interface RateLimitBindings {
  VERDICT_CACHE: KVNamespace;
}

// Hono middleware. Only POSTs are counted: CORS preflights are answered
// by the cors middleware before this runs, and GET / is a health check.
// The install id is never logged or echoed back.
export function rateLimit<E extends { Bindings: RateLimitBindings }>(
  scope: RateLimitScope,
  limit: number,
): MiddlewareHandler<E> {
  return async (c, next) => {
    if (c.req.method !== "POST") return next();

    const installId = c.req.header(INSTALL_HEADER)?.trim();
    if (!isValidInstallId(installId)) {
      return c.json({ error: "missing-install-id" }, 400);
    }

    const result = await consumeQuota(c.env.VERDICT_CACHE, scope, installId, limit);
    if (!result.allowed) return c.json({ error: "rate-limited" }, 429);

    await next();
  };
}
