import { describe, expect, it } from "vitest";
import { runEmailHeuristics } from "../src/email-heuristics";
import type { AnalyzeEmailRequest } from "../src/types";

function email(overrides: Partial<AnalyzeEmailRequest> = {}): AnalyzeEmailRequest {
  return {
    from: "alice@example.com",
    subject: "hello",
    body: "hi there",
    links: [],
    ...overrides,
  };
}

describe("runEmailHeuristics — conclusive paths", () => {
  it("a typosquatted link in body short-circuits to malicious", () => {
    const v = runEmailHeuristics(
      email({
        subject: "Account update",
        body: "Please log in: https://paypa1.com/login",
        links: ["https://paypa1.com/login"],
      }),
    );
    expect(v.conclusive).toBe(true);
    expect(v.response!.verdict).toBe("malicious");
    expect(v.response!.reasons[0]!.code).toBe("link-typosquat-of-brand");
  });

  it("display-name spoof from unrelated host short-circuits to malicious", () => {
    const v = runEmailHeuristics(
      email({
        from: "PayPal Support <noreply@randomshop.xyz>",
        subject: "Account verification",
        body: "Please verify your account.",
      }),
    );
    expect(v.conclusive).toBe(true);
    expect(v.response!.verdict).toBe("malicious");
    expect(v.response!.reasons[0]!.code).toBe("display-name-spoof");
  });

  it("link conclusive fires before display-spoof check (link is cheaper)", () => {
    const v = runEmailHeuristics(
      email({
        from: "PayPal Support <noreply@randomshop.xyz>",
        body: "https://paypa1.com/login",
        links: ["https://paypa1.com/login"],
      }),
    );
    expect(v.conclusive).toBe(true);
    expect(v.response!.reasons[0]!.code).toBe("link-typosquat-of-brand");
  });
});

describe("runEmailHeuristics — inconclusive accumulation", () => {
  it("clean email yields no reasons and goes inconclusive", () => {
    const v = runEmailHeuristics(
      email({ subject: "Hi", body: "Lunch tomorrow?" }),
    );
    expect(v.conclusive).toBe(false);
    expect(v.inconclusiveReasons).toEqual([]);
  });

  it("accumulates urgency + credential + free-email-impersonation", () => {
    // Display name has no regulated brand — that would short-circuit
    // through display-mismatch. The PayPal mention is in the subject,
    // which feeds free-email-impersonation but not display-mismatch.
    const v = runEmailHeuristics(
      email({
        from: "Notifications <support@gmail.com>",
        subject: "Your PayPal account is on hold",
        body: "Final notice: please verify your password to restore access.",
      }),
    );
    expect(v.conclusive).toBe(false);
    const codes = v.inconclusiveReasons.map((r) => r.code);
    expect(codes).toContain("urgency-language");
    expect(codes).toContain("credential-request-language");
    expect(codes).toContain("free-email-brand-impersonation");
  });

  it("accumulates reply-to-mismatch", () => {
    const v = runEmailHeuristics(
      email({
        from: "service@example.com",
        replyTo: "attacker@otherdomain.xyz",
      }),
    );
    expect(v.inconclusiveReasons.map((r) => r.code)).toContain("reply-to-mismatch");
  });

  it("accumulates auth-hint failures", () => {
    const v = runEmailHeuristics(
      email({ headerHints: { spfPass: false, dmarcPass: false } }),
    );
    const codes = v.inconclusiveReasons.map((r) => r.code);
    expect(codes).toContain("auth-spf-fail");
    expect(codes).toContain("auth-dmarc-fail");
  });

  it("flags an unparseable From and stops further From-dependent checks", () => {
    const v = runEmailHeuristics(
      email({ from: "totally not a header", replyTo: "foo@bar.com" }),
    );
    expect(v.conclusive).toBe(false);
    expect(v.inconclusiveReasons.map((r) => r.code)).toContain("unparseable-from");
    expect(v.inconclusiveReasons.map((r) => r.code)).not.toContain("reply-to-mismatch");
  });

  it("collects link inconclusive reasons (e.g. suspicious TLD) without short-circuiting", () => {
    const v = runEmailHeuristics(
      email({ links: ["https://example.zip/sale"] }),
    );
    expect(v.conclusive).toBe(false);
    expect(v.inconclusiveReasons.map((r) => r.code)).toContain("link-suspicious-tld");
  });
});

describe("runEmailHeuristics — tone compliance on conclusive copy", () => {
  it("display-spoof explanation has no banned words", () => {
    const v = runEmailHeuristics(
      email({
        from: "Wells Fargo <support@randomshop.xyz>",
        subject: "Verify",
      }),
    );
    const explanation = v.response!.explanation;
    expect(explanation).not.toMatch(/\battack\b/i);
    expect(explanation).not.toMatch(/\bdanger\b/i);
    expect(explanation).not.toMatch(/\bthreat\b/i);
    expect(explanation).not.toMatch(/\bfraud\b/i);
    expect(explanation).not.toMatch(/\bcriminal\b/i);
  });

  it("link-conclusive explanation has no banned words", () => {
    const v = runEmailHeuristics(
      email({ links: ["https://paypa1.com/login"] }),
    );
    const explanation = v.response!.explanation;
    expect(explanation).not.toMatch(/\battack\b/i);
    expect(explanation).not.toMatch(/\bdanger\b/i);
    expect(explanation).not.toMatch(/\bthreat\b/i);
    expect(explanation).not.toMatch(/\bfraud\b/i);
    expect(explanation).not.toMatch(/\bcriminal\b/i);
  });
});
