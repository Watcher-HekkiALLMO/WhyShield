import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_REQUEST_KEYWORDS,
  URGENCY_KEYWORDS,
} from "../src/email-keywords";
import { scanKeywords } from "../src/email-heuristics/keyword-scan";

describe("scanKeywords", () => {
  it("returns null when no phrase matches", () => {
    expect(scanKeywords("hello there friend", URGENCY_KEYWORDS)).toBeNull();
  });

  it("returns null on empty text", () => {
    expect(scanKeywords("", URGENCY_KEYWORDS)).toBeNull();
  });

  it("matches an urgency phrase case-insensitively", () => {
    const hit = scanKeywords(
      "Your ACCOUNT WILL BE LOCKED unless you act.",
      URGENCY_KEYWORDS,
    );
    expect(hit).not.toBeNull();
    expect(hit!.matched).toContain("account will be locked");
  });

  it("matches a credential-request phrase", () => {
    const hit = scanKeywords(
      "Please verify your password to continue.",
      CREDENTIAL_REQUEST_KEYWORDS,
    );
    expect(hit).not.toBeNull();
    expect(hit!.matched).toContain("verify your password");
  });

  it("returns every matched phrase", () => {
    const hit = scanKeywords(
      "final notice: your account will be locked. final warning.",
      URGENCY_KEYWORDS,
    );
    expect(hit).not.toBeNull();
    expect(hit!.matched).toEqual(
      expect.arrayContaining(["final notice", "final warning", "account will be locked"]),
    );
  });

  it("does not match a single word that's not on the list", () => {
    expect(scanKeywords("urgent", URGENCY_KEYWORDS)).toBeNull();
  });
});

describe("URGENCY_KEYWORDS list", () => {
  it("contains the canonical phishing pressure phrases", () => {
    expect(URGENCY_KEYWORDS).toContain("account suspended");
    expect(URGENCY_KEYWORDS).toContain("urgent action required");
    expect(URGENCY_KEYWORDS).toContain("verify immediately");
  });

  it("uses multi-word phrases (no overly generic single words)", () => {
    for (const kw of URGENCY_KEYWORDS) {
      expect(kw.split(" ").length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("CREDENTIAL_REQUEST_KEYWORDS list", () => {
  it("contains canonical credential-asking phrases", () => {
    expect(CREDENTIAL_REQUEST_KEYWORDS).toContain("verify your password");
    expect(CREDENTIAL_REQUEST_KEYWORDS).toContain("verify your identity");
  });

  it("uses multi-word phrases", () => {
    for (const kw of CREDENTIAL_REQUEST_KEYWORDS) {
      expect(kw.split(" ").length).toBeGreaterThanOrEqual(2);
    }
  });
});
