import { describe, expect, it } from "vitest";
import { buildUserMessage, SYSTEM_PROMPT, validateExplainRequest } from "../src/explain";

describe("validateExplainRequest", () => {
  const valid = {
    url: "https://paypa1.com/login",
    verdict: "malicious",
    confidence: 0.95,
    reasons: [{ code: "typosquat-of-brand", detail: "paypal.com" }],
  };

  it("accepts a well-formed request", () => {
    const result = validateExplainRequest(valid);
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://paypa1.com/login");
    expect(result!.confidence).toBe(0.95);
  });

  it("rejects null", () => {
    expect(validateExplainRequest(null)).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(validateExplainRequest("oops")).toBeNull();
    expect(validateExplainRequest(42)).toBeNull();
  });

  it("rejects missing url", () => {
    expect(validateExplainRequest({ ...valid, url: undefined })).toBeNull();
  });

  it("rejects empty url", () => {
    expect(validateExplainRequest({ ...valid, url: "" })).toBeNull();
  });

  it("rejects non-string verdict", () => {
    expect(validateExplainRequest({ ...valid, verdict: 1 })).toBeNull();
  });

  it("rejects non-number confidence", () => {
    expect(validateExplainRequest({ ...valid, confidence: "1" })).toBeNull();
  });

  it("rejects non-array reasons", () => {
    expect(validateExplainRequest({ ...valid, reasons: "no" })).toBeNull();
  });
});

describe("buildUserMessage", () => {
  it("includes url, verdict, and confidence", () => {
    const msg = buildUserMessage({
      url: "https://paypa1.com/login",
      verdict: "malicious",
      confidence: 0.95,
      reasons: [],
    });
    expect(msg).toContain("https://paypa1.com/login");
    expect(msg).toContain("malicious");
    expect(msg).toContain("0.95");
  });

  it("formats reasons as a bullet list", () => {
    const msg = buildUserMessage({
      url: "u",
      verdict: "malicious",
      confidence: 1,
      reasons: [
        { code: "typosquat-of-brand", detail: "paypal.com" },
        { code: "punycode-host" },
      ],
    });
    expect(msg).toContain("- typosquat-of-brand: paypal.com");
    expect(msg).toContain("- punycode-host");
  });

  it("shows '(none)' when no reasons", () => {
    const msg = buildUserMessage({
      url: "u",
      verdict: "safe",
      confidence: 0.5,
      reasons: [],
    });
    expect(msg).toContain("(none)");
  });
});

// Quasi-tests on the prompt itself: catch accidental deletions of the
// tone rules during future edits. Not a substitute for real model evals
// but ensures the rules are at least *present* in the system prompt.
describe("SYSTEM_PROMPT tone rules are present", () => {
  it("lists each banned word", () => {
    expect(SYSTEM_PROMPT).toMatch(/attack/);
    expect(SYSTEM_PROMPT).toMatch(/danger/);
    expect(SYSTEM_PROMPT).toMatch(/threat/);
    expect(SYSTEM_PROMPT).toMatch(/fraud/);
    expect(SYSTEM_PROMPT).toMatch(/criminal/);
  });

  it("specifies second-person address", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("second person");
  });

  it("forbids markdown output", () => {
    expect(SYSTEM_PROMPT).toMatch(/markdown/i);
  });

  it("forbids product naming", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("do not name the product");
  });
});
