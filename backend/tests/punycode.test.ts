import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/heuristics/normalize";
import { detectPunycode } from "../src/heuristics/punycode";

function n(url: string) {
  const r = normalizeUrl(url);
  if (!r) throw new Error(`bad url in test: ${url}`);
  return r;
}

describe("detectPunycode", () => {
  it("flags a punycode host", () => {
    // Cyrillic а in "paypal" causes URL() to encode the host as xn--...
    const hit = detectPunycode(n("https://pаypal.com/login"));
    expect(hit?.reason.code).toBe("punycode-host");
  });

  it("ignores plain ASCII hosts", () => {
    expect(detectPunycode(n("https://paypal.com/"))).toBeNull();
  });
});
