import { describe, expect, it } from "vitest";
import { cacheKeyForEmail } from "../src/cache";
import type { AnalyzeEmailRequest } from "../src/types";

const base: AnalyzeEmailRequest = {
  from: "alice@example.com",
  subject: "Hi",
  body: "hello",
  links: [],
};

describe("cacheKeyForEmail", () => {
  it("is deterministic for identical input", async () => {
    expect(await cacheKeyForEmail(base)).toBe(await cacheKeyForEmail(base));
  });

  it("differs when from changes", async () => {
    expect(await cacheKeyForEmail(base)).not.toBe(
      await cacheKeyForEmail({ ...base, from: "other@example.com" }),
    );
  });

  it("differs when subject changes", async () => {
    expect(await cacheKeyForEmail(base)).not.toBe(
      await cacheKeyForEmail({ ...base, subject: "Hi!" }),
    );
  });

  it("differs when body changes", async () => {
    expect(await cacheKeyForEmail(base)).not.toBe(
      await cacheKeyForEmail({ ...base, body: "different" }),
    );
  });

  it("differs when links change", async () => {
    expect(await cacheKeyForEmail(base)).not.toBe(
      await cacheKeyForEmail({ ...base, links: ["https://example.com"] }),
    );
  });

  it("is invariant to link ordering", async () => {
    const a = await cacheKeyForEmail({ ...base, links: ["a", "b", "c"] });
    const b = await cacheKeyForEmail({ ...base, links: ["c", "a", "b"] });
    expect(a).toBe(b);
  });

  it("uses an email: prefix and a 64-hex SHA-256", async () => {
    expect(await cacheKeyForEmail(base)).toMatch(/^email:[0-9a-f]{64}$/);
  });

  it("never collides with cacheKeyForUrl prefix", async () => {
    const key = await cacheKeyForEmail(base);
    expect(key.startsWith("url:")).toBe(false);
  });
});
