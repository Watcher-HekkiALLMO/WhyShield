import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/heuristics/normalize";
import { detectSuspiciousTld } from "../src/heuristics/suspicious-tld";

function n(url: string) {
  const r = normalizeUrl(url);
  if (!r) throw new Error(`bad url in test: ${url}`);
  return r;
}

describe("detectSuspiciousTld", () => {
  it("flags .zip", () => {
    const hit = detectSuspiciousTld(n("https://login.zip/account"));
    expect(hit?.reason.code).toBe("suspicious-tld");
    expect(hit?.reason.detail).toBe("zip");
  });

  it("flags .top", () => {
    expect(detectSuspiciousTld(n("https://something.top/"))?.reason.detail).toBe("top");
  });

  it("ignores .com", () => {
    expect(detectSuspiciousTld(n("https://example.com/"))).toBeNull();
  });

  it("ignores .org", () => {
    expect(detectSuspiciousTld(n("https://example.org/"))).toBeNull();
  });
});
