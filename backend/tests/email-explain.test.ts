import { describe, expect, it } from "vitest";
import {
  buildEmailUserMessage,
  SYSTEM_PROMPT_EMAIL,
  validateExplainEmailRequest,
  FALLBACK_TEXT_EMAIL,
} from "../src/email-explain";

describe("validateExplainEmailRequest", () => {
  const valid = {
    from: "PayPal <noreply@randomshop.xyz>",
    replyTo: "attacker@randomshop.xyz",
    subject: "Verify your account",
    body: "Please confirm your password.",
    links: ["https://paypa1.com/login"],
    headerHints: { spfPass: false },
    verdict: "malicious",
    confidence: 0.95,
    reasons: [{ code: "display-name-spoof", detail: "..." }],
  };

  it("accepts a well-formed request", () => {
    const r = validateExplainEmailRequest(valid);
    expect(r).not.toBeNull();
    expect(r!.from).toBe(valid.from);
    expect(r!.confidence).toBe(0.95);
    expect(r!.links).toEqual(valid.links);
  });

  it("accepts a request with optional fields omitted", () => {
    const minimal = { ...valid, replyTo: undefined, headerHints: undefined };
    expect(validateExplainEmailRequest(minimal)).not.toBeNull();
  });

  it("rejects null", () => {
    expect(validateExplainEmailRequest(null)).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(validateExplainEmailRequest("oops")).toBeNull();
    expect(validateExplainEmailRequest(42)).toBeNull();
  });

  it("rejects missing or empty from", () => {
    expect(validateExplainEmailRequest({ ...valid, from: "" })).toBeNull();
    expect(validateExplainEmailRequest({ ...valid, from: undefined })).toBeNull();
  });

  it("rejects non-string subject", () => {
    expect(validateExplainEmailRequest({ ...valid, subject: 1 })).toBeNull();
  });

  it("rejects non-string body", () => {
    expect(validateExplainEmailRequest({ ...valid, body: null })).toBeNull();
  });

  it("rejects non-array links", () => {
    expect(validateExplainEmailRequest({ ...valid, links: "no" })).toBeNull();
  });

  it("rejects non-string replyTo when present", () => {
    expect(validateExplainEmailRequest({ ...valid, replyTo: 42 })).toBeNull();
  });

  it("rejects non-string verdict", () => {
    expect(validateExplainEmailRequest({ ...valid, verdict: 1 })).toBeNull();
  });

  it("rejects non-number confidence", () => {
    expect(validateExplainEmailRequest({ ...valid, confidence: "1" })).toBeNull();
  });

  it("rejects non-array reasons", () => {
    expect(validateExplainEmailRequest({ ...valid, reasons: "no" })).toBeNull();
  });

  it("rejects headerHints that's not an object", () => {
    expect(validateExplainEmailRequest({ ...valid, headerHints: "no" })).toBeNull();
  });
});

describe("buildEmailUserMessage", () => {
  const base = {
    from: "PayPal <noreply@randomshop.xyz>",
    replyTo: "attacker@otherdomain.xyz",
    subject: "Account suspended",
    body: "Verify your password immediately.",
    links: ["https://paypa1.com/login"],
    verdict: "malicious" as const,
    confidence: 0.95,
    reasons: [{ code: "display-name-spoof" as const, detail: "claims PayPal" }],
  };

  it("includes from, reply-to, subject, verdict, and confidence", () => {
    const msg = buildEmailUserMessage(base);
    expect(msg).toContain(base.from);
    expect(msg).toContain(base.replyTo);
    expect(msg).toContain(base.subject);
    expect(msg).toContain("malicious");
    expect(msg).toContain("0.95");
  });

  it("includes the body verbatim when short", () => {
    const msg = buildEmailUserMessage(base);
    expect(msg).toContain("Verify your password immediately.");
  });

  it("renders links as a bulleted list", () => {
    const msg = buildEmailUserMessage(base);
    expect(msg).toContain("- https://paypa1.com/login");
  });

  it("shows '(none)' when no links", () => {
    const msg = buildEmailUserMessage({ ...base, links: [] });
    expect(msg).toContain("Links found in body:\n(none)");
  });

  it("renders reasons as a bulleted list with detail", () => {
    const msg = buildEmailUserMessage(base);
    expect(msg).toContain("- display-name-spoof: claims PayPal");
  });

  it("shows '(none)' for empty reasons", () => {
    const msg = buildEmailUserMessage({ ...base, reasons: [] });
    expect(msg).toContain("Heuristic signals from our pre-filter:\n(none)");
  });

  it("renders '(same as From)' when replyTo is undefined", () => {
    const msg = buildEmailUserMessage({ ...base, replyTo: undefined });
    expect(msg).toContain("Reply-To: (same as From)");
  });

  it("truncates very long bodies and notes the truncation", () => {
    const long = "x".repeat(5000);
    const msg = buildEmailUserMessage({ ...base, body: long });
    expect(msg).toContain("[...truncated, original was 5000 chars]");
    expect(msg.length).toBeLessThan(long.length + 1000);
  });
});

describe("SYSTEM_PROMPT_EMAIL tone rules are present", () => {
  it("lists each banned word", () => {
    expect(SYSTEM_PROMPT_EMAIL).toMatch(/attack/);
    expect(SYSTEM_PROMPT_EMAIL).toMatch(/danger/);
    expect(SYSTEM_PROMPT_EMAIL).toMatch(/threat/);
    expect(SYSTEM_PROMPT_EMAIL).toMatch(/fraud/);
    expect(SYSTEM_PROMPT_EMAIL).toMatch(/criminal/);
  });

  it("specifies second-person address", () => {
    expect(SYSTEM_PROMPT_EMAIL.toLowerCase()).toContain("second person");
  });

  it("forbids markdown output", () => {
    expect(SYSTEM_PROMPT_EMAIL).toMatch(/markdown/i);
  });

  it("forbids product naming", () => {
    expect(SYSTEM_PROMPT_EMAIL.toLowerCase()).toContain("do not name the product");
  });

  it("specifies the 2-3 paragraph structure", () => {
    expect(SYSTEM_PROMPT_EMAIL).toMatch(/2-3 short paragraphs/i);
  });

  it("addresses email-specific signals (not URL signals)", () => {
    const lower = SYSTEM_PROMPT_EMAIL.toLowerCase();
    expect(lower).toContain("email");
    expect(lower).toContain("from address");
  });
});

describe("FALLBACK_TEXT_EMAIL", () => {
  it("contains no banned words", () => {
    expect(FALLBACK_TEXT_EMAIL).not.toMatch(/\battack\b/i);
    expect(FALLBACK_TEXT_EMAIL).not.toMatch(/\bdanger\b/i);
    expect(FALLBACK_TEXT_EMAIL).not.toMatch(/\bthreat\b/i);
    expect(FALLBACK_TEXT_EMAIL).not.toMatch(/\bfraud\b/i);
    expect(FALLBACK_TEXT_EMAIL).not.toMatch(/\bcriminal\b/i);
  });

  it("does not name the product", () => {
    expect(FALLBACK_TEXT_EMAIL).not.toMatch(/whyshield/i);
  });
});
