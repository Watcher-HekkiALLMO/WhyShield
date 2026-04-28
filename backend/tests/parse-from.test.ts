import { describe, expect, it } from "vitest";
import { parseFromHeader } from "../src/email-heuristics/parse-from";

describe("parseFromHeader", () => {
  it("parses a bare addr@host", () => {
    const r = parseFromHeader("alice@example.com");
    expect(r).not.toBeNull();
    expect(r!.displayName).toBeNull();
    expect(r!.email).toBe("alice@example.com");
    expect(r!.host).toBe("example.com");
  });

  it("parses an angle-bracketed address with no display name", () => {
    const r = parseFromHeader("<alice@example.com>");
    expect(r).not.toBeNull();
    expect(r!.displayName).toBeNull();
    expect(r!.host).toBe("example.com");
  });

  it("parses display name + angle-bracketed address", () => {
    const r = parseFromHeader("Alice Example <alice@example.com>");
    expect(r).not.toBeNull();
    expect(r!.displayName).toBe("Alice Example");
    expect(r!.email).toBe("alice@example.com");
    expect(r!.host).toBe("example.com");
  });

  it("parses quoted display name + angle-bracketed address", () => {
    const r = parseFromHeader('"PayPal Service" <noreply@paypa1.com>');
    expect(r).not.toBeNull();
    expect(r!.displayName).toBe("PayPal Service");
    expect(r!.host).toBe("paypa1.com");
  });

  it("lowercases the host", () => {
    const r = parseFromHeader("Alice <alice@Example.COM>");
    expect(r!.host).toBe("example.com");
  });

  it("preserves display-name casing", () => {
    const r = parseFromHeader("PayPal <noreply@example.com>");
    expect(r!.displayName).toBe("PayPal");
  });

  it("returns null on empty input", () => {
    expect(parseFromHeader("")).toBeNull();
    expect(parseFromHeader("   ")).toBeNull();
  });

  it("returns null on no @-sign", () => {
    expect(parseFromHeader("not-an-email")).toBeNull();
  });

  it("returns null on missing local-part", () => {
    expect(parseFromHeader("@example.com")).toBeNull();
  });

  it("returns null on missing host", () => {
    expect(parseFromHeader("alice@")).toBeNull();
  });

  it("returns null on missing closing bracket", () => {
    expect(parseFromHeader("Alice <alice@example.com")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    const r = parseFromHeader("   Alice <alice@example.com>   ");
    expect(r!.displayName).toBe("Alice");
    expect(r!.host).toBe("example.com");
  });
});
