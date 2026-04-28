import { describe, expect, it } from "vitest";
import { detectFreeEmailImpersonation } from "../src/email-heuristics/free-email-impersonation";
import type { ParsedFrom } from "../src/email-heuristics/parse-from";

function from(displayName: string | null, host: string): ParsedFrom {
  return { displayName, email: `someone@${host}`, host };
}

describe("detectFreeEmailImpersonation", () => {
  it("fires when gmail sender mentions PayPal in display name", () => {
    const hit = detectFreeEmailImpersonation(
      from("PayPal Notifications", "gmail.com"),
      "(none)",
    );
    expect(hit).not.toBeNull();
    expect(hit!.reason.code).toBe("free-email-brand-impersonation");
    expect(hit!.reason.detail).toContain("gmail.com");
    expect(hit!.reason.detail).toContain("PayPal");
  });

  it("fires when free-email sender mentions a brand only in the subject", () => {
    const hit = detectFreeEmailImpersonation(
      from(null, "outlook.com"),
      "Action required: confirm your Chase account",
    );
    expect(hit).not.toBeNull();
    expect(hit!.reason.detail).toContain("Chase");
  });

  it("does not fire when sender is not on a free-email provider", () => {
    expect(
      detectFreeEmailImpersonation(
        from("PayPal", "service.paypal.com"),
        "Subject",
      ),
    ).toBeNull();
  });

  it("does not fire when no brand is mentioned anywhere", () => {
    expect(
      detectFreeEmailImpersonation(from("Alice", "gmail.com"), "lunch?"),
    ).toBeNull();
  });

  it("respects word boundaries (does not match inside another word)", () => {
    expect(
      detectFreeEmailImpersonation(
        from("Visualizations newsletter", "gmail.com"),
        "weekly roundup",
      ),
    ).toBeNull();
  });

  it("returns inconclusive confidence (< 0.85)", () => {
    const hit = detectFreeEmailImpersonation(
      from("FedEx Delivery", "yahoo.com"),
      "Your package",
    );
    expect(hit!.confidence).toBeLessThan(0.85);
  });

  it("matches case-insensitively", () => {
    const hit = detectFreeEmailImpersonation(
      from(null, "gmail.com"),
      "your IRS refund is ready",
    );
    expect(hit).not.toBeNull();
    expect(hit!.reason.detail).toContain("IRS");
  });
});
