import { describe, expect, it } from "vitest";
import { detectIpHost } from "../src/heuristics/ip-host";
import { normalizeUrl } from "../src/heuristics/normalize";

function n(url: string) {
  const r = normalizeUrl(url);
  if (!r) throw new Error(`bad url in test: ${url}`);
  return r;
}

describe("detectIpHost", () => {
  it("flags an IPv4 host", () => {
    const hit = detectIpHost(n("http://192.168.1.10/login"));
    expect(hit?.reason.code).toBe("ip-as-host");
    expect(hit?.reason.detail).toBe("192.168.1.10");
  });

  it("flags an IPv6 host", () => {
    const hit = detectIpHost(n("http://[2001:db8::1]/x"));
    expect(hit?.reason.code).toBe("ip-as-host");
  });

  it("ignores normal domain names", () => {
    expect(detectIpHost(n("https://example.com/"))).toBeNull();
  });
});
