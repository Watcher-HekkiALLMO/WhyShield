import { describe, expect, it } from "vitest";
import { detectReplyToMismatch } from "../src/email-heuristics/reply-to";
import type { ParsedFrom } from "../src/email-heuristics/parse-from";

function from(host: string): ParsedFrom {
  return { displayName: null, email: `noreply@${host}`, host };
}

describe("detectReplyToMismatch", () => {
  it("fires when reply-to is on a different registrable domain", () => {
    const hit = detectReplyToMismatch(from("paypal.com"), "attacker@randomdomain.xyz");
    expect(hit).not.toBeNull();
    expect(hit!.reason.code).toBe("reply-to-mismatch");
    expect(hit!.reason.detail).toContain("paypal.com");
    expect(hit!.reason.detail).toContain("randomdomain.xyz");
  });

  it("does not fire when reply-to host equals from host", () => {
    expect(
      detectReplyToMismatch(from("paypal.com"), "support@paypal.com"),
    ).toBeNull();
  });

  it("does not fire across subdomains of the same registrable domain", () => {
    expect(
      detectReplyToMismatch(from("service.paypal.com"), "support@reply.paypal.com"),
    ).toBeNull();
  });

  it("does not fire when reply-to is undefined", () => {
    expect(detectReplyToMismatch(from("paypal.com"), undefined)).toBeNull();
  });

  it("does not fire when reply-to is empty", () => {
    expect(detectReplyToMismatch(from("paypal.com"), "")).toBeNull();
    expect(detectReplyToMismatch(from("paypal.com"), "   ")).toBeNull();
  });

  it("does not fire when reply-to is unparseable (no signal)", () => {
    expect(detectReplyToMismatch(from("paypal.com"), "not-an-email")).toBeNull();
  });

  it("returns inconclusive confidence (< 0.85)", () => {
    const hit = detectReplyToMismatch(from("paypal.com"), "attacker@randomdomain.xyz");
    expect(hit!.confidence).toBeLessThan(0.85);
  });

  it("accepts an angle-bracketed reply-to", () => {
    const hit = detectReplyToMismatch(
      from("paypal.com"),
      "Reply <attacker@randomdomain.xyz>",
    );
    expect(hit).not.toBeNull();
  });
});
