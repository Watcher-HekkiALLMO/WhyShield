import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  INSTALL_HEADER,
  MEMORY_MAX_ENTRIES,
  type MemoryCounts,
  RATE_LIMIT_TTL_SECONDS,
  consumeQuota,
  hourBucket,
  isValidInstallId,
  rateLimit,
  rateLimitKey,
} from "../src/rate-limit";

// Minimal in-memory stand-in for the KV binding. Only get/put are used
// by the limiter. Flags let a test simulate a storage outage or the
// real-world stale read cache.
class FakeKV {
  store = new Map<string, string>();
  lastTtl: number | undefined;
  failReads = false;
  failWrites = false;
  // When set, get() returns this instead of the stored value, imitating
  // KV's per-location read cache lagging behind writes.
  staleReadValue: string | null | undefined;

  async get(key: string): Promise<string | null> {
    if (this.failReads) throw new Error("kv read failed");
    if (this.staleReadValue !== undefined) return this.staleReadValue;
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    if (this.failWrites) throw new Error("kv write failed");
    this.lastTtl = opts?.expirationTtl;
    this.store.set(key, value);
  }
}

const asKV = (kv: FakeKV) => kv as unknown as KVNamespace;
const UUID = "3f2b1c4e-9d8a-4b7c-a1e2-0f9d8c7b6a5e";
const T0 = new Date(Date.UTC(2026, 9, 13, 7, 5, 0)); // 2026-10-13 07:05 UTC

// Each test gets its own memory layer so state never leaks between them.
const quota = (
  kv: FakeKV,
  memory: MemoryCounts,
  scope: "analyze" | "explain",
  id: string,
  limit: number,
  now = T0,
) => consumeQuota(asKV(kv), scope, id, limit, now, memory);

describe("hourBucket", () => {
  it("formats as UTC yyyymmddhh with zero padding", () => {
    expect(hourBucket(T0)).toBe("2026101307");
    expect(hourBucket(new Date(Date.UTC(2026, 0, 2, 3)))).toBe("2026010203");
  });

  it("ignores minutes and seconds", () => {
    expect(hourBucket(new Date(Date.UTC(2026, 9, 13, 7, 59, 59)))).toBe(hourBucket(T0));
  });
});

describe("rateLimitKey", () => {
  it("has the rl:<scope>:<id>:<bucket> shape", () => {
    expect(rateLimitKey("analyze", UUID, T0)).toBe(`rl:analyze:${UUID}:2026101307`);
    expect(rateLimitKey("explain", UUID, T0)).toBe(`rl:explain:${UUID}:2026101307`);
  });
});

describe("isValidInstallId", () => {
  it("accepts a UUID", () => {
    expect(isValidInstallId(UUID)).toBe(true);
  });

  it("rejects missing, empty, too short, too long, and unsafe characters", () => {
    expect(isValidInstallId(undefined)).toBe(false);
    expect(isValidInstallId("")).toBe(false);
    expect(isValidInstallId("abc")).toBe(false);
    expect(isValidInstallId("a".repeat(65))).toBe(false);
    expect(isValidInstallId("abc/def/ghi")).toBe(false);
    expect(isValidInstallId("abc def ghi")).toBe(false);
    expect(isValidInstallId("rl:injected:key")).toBe(false);
  });
});

describe("consumeQuota", () => {
  it("allows up to the limit and denies the next one", async () => {
    const kv = new FakeKV();
    const mem: MemoryCounts = new Map();
    for (let i = 1; i <= 3; i++) {
      expect(await quota(kv, mem, "analyze", UUID, 3)).toEqual({ allowed: true, count: i });
    }
    expect(await quota(kv, mem, "analyze", UUID, 3)).toEqual({ allowed: false });
  });

  it("writes counters with the 2h TTL", async () => {
    const kv = new FakeKV();
    await quota(kv, new Map(), "analyze", UUID, 3);
    expect(kv.lastTtl).toBe(RATE_LIMIT_TTL_SECONDS);
  });

  it("keeps installs independent", async () => {
    const kv = new FakeKV();
    const mem: MemoryCounts = new Map();
    await quota(kv, mem, "analyze", UUID, 1);
    expect(await quota(kv, mem, "analyze", UUID, 1)).toEqual({ allowed: false });
    expect(await quota(kv, mem, "analyze", "other-install-id", 1)).toEqual({
      allowed: true,
      count: 1,
    });
  });

  it("keeps analyze and explain budgets independent", async () => {
    const kv = new FakeKV();
    const mem: MemoryCounts = new Map();
    await quota(kv, mem, "analyze", UUID, 1);
    expect(await quota(kv, mem, "analyze", UUID, 1)).toEqual({ allowed: false });
    expect(await quota(kv, mem, "explain", UUID, 1)).toEqual({ allowed: true, count: 1 });
  });

  it("starts fresh in the next hour bucket", async () => {
    const kv = new FakeKV();
    const mem: MemoryCounts = new Map();
    await quota(kv, mem, "analyze", UUID, 1);
    expect(await quota(kv, mem, "analyze", UUID, 1)).toEqual({ allowed: false });
    const nextHour = new Date(T0.getTime() + 60 * 60 * 1000);
    expect(await quota(kv, mem, "analyze", UUID, 1, nextHour)).toEqual({
      allowed: true,
      count: 1,
    });
  });

  it("still trips on a burst when KV reads are stale (the production case)", async () => {
    const kv = new FakeKV();
    kv.staleReadValue = null; // KV never reflects our writes
    const mem: MemoryCounts = new Map();
    for (let i = 1; i <= 5; i++) {
      expect(await quota(kv, mem, "analyze", UUID, 5)).toEqual({ allowed: true, count: i });
    }
    expect(await quota(kv, mem, "analyze", UUID, 5)).toEqual({ allowed: false });
  });

  it("trusts a higher KV count from another location over local memory", async () => {
    const kv = new FakeKV();
    kv.staleReadValue = "5"; // some other isolate already counted to the limit
    expect(await quota(kv, new Map(), "analyze", UUID, 5)).toEqual({ allowed: false });
  });

  it("degrades to memory-only counting when KV reads fail", async () => {
    const kv = new FakeKV();
    kv.failReads = true;
    const mem: MemoryCounts = new Map();
    expect(await quota(kv, mem, "analyze", UUID, 2)).toEqual({ allowed: true, count: 1 });
    expect(await quota(kv, mem, "analyze", UUID, 2)).toEqual({ allowed: true, count: 2 });
    // Same-isolate bursts are still stopped even with KV unreadable.
    expect(await quota(kv, mem, "analyze", UUID, 2)).toEqual({ allowed: false });
  });

  it("stops adding memory entries past the cap but keeps counting existing ones", async () => {
    const kv = new FakeKV();
    const mem: MemoryCounts = new Map();
    for (let i = 0; i < MEMORY_MAX_ENTRIES; i++) mem.set(`rl:analyze:filler-${i}:2026101307`, 1);
    // A brand-new id is not admitted to memory (but is still allowed via KV).
    expect(await quota(kv, mem, "analyze", "newcomer-id-1234", 5)).toEqual({
      allowed: true,
      count: 1,
    });
    expect(mem.size).toBe(MEMORY_MAX_ENTRIES);
    // An id already present keeps advancing.
    expect(await quota(kv, mem, "analyze", "filler-0", 5)).toEqual({ allowed: true, count: 2 });
    expect(mem.get("rl:analyze:filler-0:2026101307")).toBe(2);
  });

  it("fails open when KV writes fail, with memory still counting", async () => {
    const kv = new FakeKV();
    kv.failWrites = true;
    const mem: MemoryCounts = new Map();
    expect(await quota(kv, mem, "analyze", UUID, 2)).toEqual({ allowed: true, count: 1 });
    expect(await quota(kv, mem, "analyze", UUID, 2)).toEqual({ allowed: true, count: 2 });
    // Memory alone is enough to stop a burst even while KV is down.
    expect(await quota(kv, mem, "analyze", UUID, 2)).toEqual({ allowed: false });
  });
});

describe("rateLimit middleware", () => {
  type Env = { Bindings: { VERDICT_CACHE: KVNamespace } };

  // Each app gets unique install ids so the module-level memory layer
  // (shared across tests, like a real isolate) can't bleed between cases.
  let seq = 0;
  const freshId = () => `test-install-${Date.now()}-${seq++}`;

  function buildApp(analyzeLimit: number, explainLimit = analyzeLimit) {
    const app = new Hono<Env>();
    app.use("/analyze/*", rateLimit<Env>("analyze", analyzeLimit));
    app.use("/explain/*", rateLimit<Env>("explain", explainLimit));
    app.post("/analyze/url", (c) => c.json({ ok: true }));
    app.post("/explain/url", (c) => c.json({ ok: true }));
    app.get("/", (c) => c.text("ok"));
    return app;
  }

  const post = (app: Hono<Env>, kv: FakeKV, path: string, headers: Record<string, string>) =>
    app.request(path, { method: "POST", headers }, { VERDICT_CACHE: asKV(kv) });

  it("returns 400 when the install header is missing or malformed", async () => {
    const app = buildApp(5);
    const kv = new FakeKV();
    const missing = await post(app, kv, "/analyze/url", {});
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "missing-install-id" });

    const bad = await post(app, kv, "/analyze/url", { [INSTALL_HEADER]: "not valid!" });
    expect(bad.status).toBe(400);
    expect(kv.store.size).toBe(0); // nothing was counted
  });

  it("passes requests through until the limit, then 429s with the documented body", async () => {
    const app = buildApp(5);
    const kv = new FakeKV();
    const id = freshId();
    for (let i = 0; i < 5; i++) {
      const res = await post(app, kv, "/analyze/url", { [INSTALL_HEADER]: id });
      expect(res.status).toBe(200);
    }
    const limited = await post(app, kv, "/analyze/url", { [INSTALL_HEADER]: id });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate-limited" });
  });

  it("exhausting analyze leaves explain available", async () => {
    const app = buildApp(1, 1);
    const kv = new FakeKV();
    const id = freshId();
    expect((await post(app, kv, "/analyze/url", { [INSTALL_HEADER]: id })).status).toBe(200);
    expect((await post(app, kv, "/analyze/url", { [INSTALL_HEADER]: id })).status).toBe(429);
    expect((await post(app, kv, "/explain/url", { [INSTALL_HEADER]: id })).status).toBe(200);
  });

  it("does not count or gate GET requests", async () => {
    const app = buildApp(0);
    const kv = new FakeKV();
    const res = await app.request("/", { method: "GET" }, { VERDICT_CACHE: asKV(kv) });
    expect(res.status).toBe(200);
    expect(kv.store.size).toBe(0);
  });

  it("never echoes the install id in a response", async () => {
    const app = buildApp(0);
    const kv = new FakeKV();
    const id = freshId();
    const res = await post(app, kv, "/analyze/url", { [INSTALL_HEADER]: id });
    expect(res.status).toBe(429);
    expect(await res.text()).not.toContain(id);
  });
});
