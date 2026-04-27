import { describe, it, expect } from "vitest";
import { normalizeUrl, foldHomoglyphs } from "../src/heuristics/normalize";

describe("normalizeUrl", () => {
  it("parses a basic https url", () => {
    const n = normalizeUrl("https://www.example.com/path");
    expect(n).not.toBeNull();
    expect(n!.host).toBe("www.example.com");
    expect(n!.isPunycode).toBe(false);
  });

  it("lowercases the host", () => {
    const n = normalizeUrl("https://EXAMPLE.com");
    expect(n!.host).toBe("example.com");
  });

  it("strips port from the host", () => {
    const n = normalizeUrl("https://example.com:8443/x");
    expect(n!.host).toBe("example.com");
  });

  it("strips a trailing dot from the host", () => {
    const n = normalizeUrl("https://example.com./x");
    expect(n!.host).toBe("example.com");
  });

  it("flags hosts containing a punycode label", () => {
    // The URL constructor auto-encodes Unicode hostnames to xn-- form,
    // so a Cyrillic-а spoof of paypal.com lands here as punycode.
    const n = normalizeUrl("https://pаypal.com/login");
    expect(n!.isPunycode).toBe(true);
  });

  it("does not flag plain ASCII as punycode", () => {
    const n = normalizeUrl("https://paypal.com/login");
    expect(n!.isPunycode).toBe(false);
  });

  it("returns null for malformed URLs", () => {
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });

  it("returns null for non-http schemes", () => {
    expect(normalizeUrl("mailto:foo@bar.com")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://example.com")).toBeNull();
  });
});

describe("foldHomoglyphs", () => {
  it("leaves plain ASCII unchanged", () => {
    expect(foldHomoglyphs("paypal.com")).toBe("paypal.com");
  });

  it("folds Cyrillic а to Latin a", () => {
    expect(foldHomoglyphs("pаypal.com")).toBe("paypal.com");
  });

  it("folds Cyrillic о to Latin o", () => {
    expect(foldHomoglyphs("gооgle.com")).toBe("google.com");
  });

  it("folds Greek α to Latin a", () => {
    expect(foldHomoglyphs("pαypal.com")).toBe("paypal.com");
  });

  it("leaves non-Latin characters not in the map alone", () => {
    expect(foldHomoglyphs("中国.com")).toBe("中国.com");
  });
});
