import { describe, expect, it } from "vitest";
import {
  detectDisplayMismatch,
  hostBelongsToDomain,
} from "../src/email-heuristics/display-mismatch";
import type { ParsedFrom } from "../src/email-heuristics/parse-from";

function from(displayName: string | null, host: string): ParsedFrom {
  return { displayName, email: `someone@${host}`, host };
}

describe("detectDisplayMismatch", () => {
  it("fires conclusive when display claims PayPal but host is unrelated", () => {
    const hit = detectDisplayMismatch(from("PayPal Service", "randomshop.xyz"));
    expect(hit).not.toBeNull();
    expect(hit!.conclusive).toBe(true);
    expect(hit!.reason.code).toBe("display-name-spoof");
    expect(hit!.reason.detail).toContain("PayPal");
    expect(hit!.reason.detail).toContain("randomshop.xyz");
  });

  it("does not fire when display name is null", () => {
    expect(detectDisplayMismatch(from(null, "randomshop.xyz"))).toBeNull();
  });

  it("does not fire when display mentions no regulated brand", () => {
    expect(detectDisplayMismatch(from("Local Pizza", "pizza.com"))).toBeNull();
  });

  it("does not fire when host is the brand's exact domain", () => {
    expect(detectDisplayMismatch(from("PayPal", "paypal.com"))).toBeNull();
  });

  it("does not fire when host is a subdomain of the brand", () => {
    expect(detectDisplayMismatch(from("PayPal", "service.paypal.com"))).toBeNull();
  });

  it("does not fire when host is a 1-edit typosquat (per spec — caught elsewhere)", () => {
    expect(detectDisplayMismatch(from("PayPal", "paypa1.com"))).toBeNull();
  });

  it("matches case-insensitively", () => {
    const hit = detectDisplayMismatch(from("paypal customer support", "randomshop.xyz"));
    expect(hit).not.toBeNull();
  });

  it("respects word boundaries (does not match Apple inside PineApple)", () => {
    expect(detectDisplayMismatch(from("PineApple Inc.", "randomshop.xyz"))).toBeNull();
  });

  it("matches a multi-word brand name", () => {
    const hit = detectDisplayMismatch(from("Bank of America Online", "randomshop.xyz"));
    expect(hit).not.toBeNull();
    expect(hit!.reason.detail).toContain("Bank of America");
  });

  it("matches a brand name from a fake-shipping scenario", () => {
    const hit = detectDisplayMismatch(from("UPS Delivery", "delivery-update.top"));
    expect(hit).not.toBeNull();
    expect(hit!.reason.detail).toContain("UPS");
  });
});

describe("hostBelongsToDomain", () => {
  it("matches the exact domain", () => {
    expect(hostBelongsToDomain("paypal.com", "paypal.com")).toBe(true);
  });
  it("matches a subdomain", () => {
    expect(hostBelongsToDomain("service.paypal.com", "paypal.com")).toBe(true);
  });
  it("does not match a sibling label that ends in the domain string", () => {
    expect(hostBelongsToDomain("evil-paypal.com", "paypal.com")).toBe(false);
  });
  it("does not match an unrelated domain", () => {
    expect(hostBelongsToDomain("example.com", "paypal.com")).toBe(false);
  });
});
