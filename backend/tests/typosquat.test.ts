import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/heuristics/normalize";
import { detectTyposquat, editDistance } from "../src/heuristics/typosquat";

function n(url: string) {
  const r = normalizeUrl(url);
  if (!r) throw new Error(`bad url in test: ${url}`);
  return r;
}

describe("editDistance (Damerau-Levenshtein)", () => {
  it("is 0 for identical strings", () => {
    expect(editDistance("paypal", "paypal")).toBe(0);
  });
  it("is 1 for a single substitution", () => {
    expect(editDistance("paypal", "paypa1")).toBe(1);
  });
  it("is 1 for a single insertion", () => {
    expect(editDistance("paypal", "paypall")).toBe(1);
  });
  it("is 1 for a single deletion", () => {
    expect(editDistance("paypal", "paypa")).toBe(1);
  });
  it("is 1 for a transposition of adjacent characters", () => {
    expect(editDistance("paypal", "paypla")).toBe(1);
  });
  it("is greater than 1 for longer differences", () => {
    expect(editDistance("paypal", "applepay")).toBeGreaterThan(1);
  });
});

describe("detectTyposquat", () => {
  it("flags a one-character substitution of a brand", () => {
    const hit = detectTyposquat(n("https://paypa1.com/login"));
    expect(hit?.reason.code).toBe("typosquat-of-brand");
    expect(hit?.reason.detail).toBe("paypal.com");
  });

  it("flags a transposition of a brand", () => {
    const hit = detectTyposquat(n("https://paypla.com/"));
    expect(hit?.reason.code).toBe("typosquat-of-brand");
  });

  it("ignores legitimate paypal.com", () => {
    expect(detectTyposquat(n("https://www.paypal.com/login"))).toBeNull();
  });

  it("ignores domains far from any brand", () => {
    expect(detectTyposquat(n("https://example.com"))).toBeNull();
  });

  it("strips www. before comparing", () => {
    expect(detectTyposquat(n("https://www.paypa1.com/"))).not.toBeNull();
  });
});
