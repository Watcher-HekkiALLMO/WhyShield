import { describe, expect, it } from "vitest";
import { detectAuthFailures } from "../src/email-heuristics/auth-hints";

describe("detectAuthFailures", () => {
  it("returns no reasons when hints are undefined", () => {
    expect(detectAuthFailures(undefined)).toEqual([]);
  });

  it("returns no reasons when every check passed", () => {
    expect(
      detectAuthFailures({ spfPass: true, dkimPass: true, dmarcPass: true }),
    ).toEqual([]);
  });

  it("returns no reasons when checks are missing (undefined)", () => {
    expect(detectAuthFailures({})).toEqual([]);
  });

  it("flags only SPF when only SPF failed", () => {
    const r = detectAuthFailures({ spfPass: false });
    expect(r.map((x) => x.code)).toEqual(["auth-spf-fail"]);
  });

  it("flags only DKIM when only DKIM failed", () => {
    const r = detectAuthFailures({ dkimPass: false });
    expect(r.map((x) => x.code)).toEqual(["auth-dkim-fail"]);
  });

  it("flags only DMARC when only DMARC failed", () => {
    const r = detectAuthFailures({ dmarcPass: false });
    expect(r.map((x) => x.code)).toEqual(["auth-dmarc-fail"]);
  });

  it("flags all three when all three failed", () => {
    const r = detectAuthFailures({
      spfPass: false,
      dkimPass: false,
      dmarcPass: false,
    });
    expect(r.map((x) => x.code)).toEqual([
      "auth-spf-fail",
      "auth-dkim-fail",
      "auth-dmarc-fail",
    ]);
  });

  it("treats undefined check as no signal even when others fail", () => {
    const r = detectAuthFailures({ spfPass: undefined, dkimPass: false });
    expect(r.map((x) => x.code)).toEqual(["auth-dkim-fail"]);
  });
});
