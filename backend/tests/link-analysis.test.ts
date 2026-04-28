import { describe, expect, it } from "vitest";
import { analyzeLinks } from "../src/email-heuristics/link-analysis";

describe("analyzeLinks", () => {
  it("returns empty inconclusive set for no links", () => {
    const r = analyzeLinks([]);
    expect(r.conclusive).toBe(false);
    expect(r.inconclusiveReasons).toEqual([]);
  });

  it("ignores malformed URLs", () => {
    const r = analyzeLinks(["not-a-url", "javascript:alert(1)"]);
    expect(r.conclusive).toBe(false);
    expect(r.inconclusiveReasons).toEqual([]);
  });

  it("bubbles up a typosquat link as conclusive malicious", () => {
    const r = analyzeLinks(["https://paypa1.com/login"]);
    expect(r.conclusive).toBe(true);
    expect(r.conclusiveReason).not.toBeNull();
    expect(r.conclusiveReason!.code).toBe("link-typosquat-of-brand");
    expect(r.conclusiveReason!.detail).toContain("paypal.com");
    expect(r.conclusiveReason!.detail).toContain("https://paypa1.com/login");
  });

  it("bubbles up an IP-as-host link as conclusive malicious", () => {
    const r = analyzeLinks(["http://203.0.113.5/login"]);
    expect(r.conclusive).toBe(true);
    expect(r.conclusiveReason!.code).toBe("link-ip-as-host");
  });

  it("returns conclusive explanation copy that is tone-compliant", () => {
    const r = analyzeLinks(["https://paypa1.com/login"]);
    const explanation = r.conclusiveExplanation!;
    // Soft framings present
    expect(explanation).toMatch(/phishing/i);
    // No banned words
    expect(explanation).not.toMatch(/\battack\b/i);
    expect(explanation).not.toMatch(/\bdanger\b/i);
    expect(explanation).not.toMatch(/\bthreat\b/i);
    expect(explanation).not.toMatch(/\bfraud\b/i);
    expect(explanation).not.toMatch(/\bcriminal\b/i);
  });

  it("collects inconclusive link reasons when nothing fires conclusively", () => {
    const r = analyzeLinks(["https://example.zip/promo"]);
    expect(r.conclusive).toBe(false);
    expect(r.inconclusiveReasons.length).toBeGreaterThan(0);
    const codes = r.inconclusiveReasons.map((x) => x.code);
    expect(codes).toContain("link-suspicious-tld");
  });

  it("annotates inconclusive reasons with the offending link", () => {
    const r = analyzeLinks(["https://example.zip/promo"]);
    expect(r.inconclusiveReasons[0]!.detail).toContain("https://example.zip/promo");
  });

  it("stops at the first conclusive link (short-circuit)", () => {
    const r = analyzeLinks([
      "https://paypa1.com/login",
      "https://chase-secure.xyz/verify",
    ]);
    expect(r.conclusive).toBe(true);
    expect(r.conclusiveReason!.detail).toContain("paypa1.com");
  });
});
