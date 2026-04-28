import { describe, expect, it } from "vitest";
import {
  buildEmailUserMessage,
  EMAIL_CLASSIFIER_SYSTEM_PROMPT,
} from "../src/email-claude";
import type { AnalyzeEmailRequest } from "../src/types";

const baseRequest: AnalyzeEmailRequest = {
  from: "PayPal <noreply@randomshop.xyz>",
  replyTo: "attacker@otherdomain.xyz",
  subject: "Account suspended",
  body: "Verify your password immediately.",
  links: ["https://paypa1.com/login"],
};

describe("buildEmailUserMessage (classifier)", () => {
  it("includes from, reply-to, and subject", () => {
    const msg = buildEmailUserMessage(baseRequest, []);
    expect(msg).toContain(baseRequest.from);
    expect(msg).toContain(baseRequest.replyTo!);
    expect(msg).toContain(baseRequest.subject);
  });

  it("renders '(same as From)' when reply-to is undefined", () => {
    const msg = buildEmailUserMessage({ ...baseRequest, replyTo: undefined }, []);
    expect(msg).toContain("Reply-To: (same as From)");
  });

  it("renders '(none)' when no links", () => {
    const msg = buildEmailUserMessage({ ...baseRequest, links: [] }, []);
    expect(msg).toContain("Links found in body:\n(none)");
  });

  it("renders '(no heuristic signals fired)' on empty hints", () => {
    const msg = buildEmailUserMessage(baseRequest, []);
    expect(msg).toContain("(no heuristic signals fired)");
  });

  it("formats heuristic hints as a bulleted list", () => {
    const msg = buildEmailUserMessage(baseRequest, [
      { code: "urgency-language", detail: "account suspended" },
      { code: "credential-request-language" },
    ]);
    expect(msg).toContain("- urgency-language: account suspended");
    expect(msg).toContain("- credential-request-language");
  });

  it("truncates very long bodies", () => {
    const long = "x".repeat(5000);
    const msg = buildEmailUserMessage({ ...baseRequest, body: long }, []);
    expect(msg).toContain("[...truncated, original was 5000 chars]");
  });
});

describe("EMAIL_CLASSIFIER_SYSTEM_PROMPT tone + output rules", () => {
  it("lists each banned word", () => {
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT).toMatch(/attack/);
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT).toMatch(/danger/);
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT).toMatch(/threat/);
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT).toMatch(/fraud/);
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT).toMatch(/criminal/);
  });

  it("specifies second-person address", () => {
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain("second person");
  });

  it("requires JSON-only output", () => {
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT).toMatch(/JSON object/);
  });

  it("specifies the verdict schema", () => {
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT).toMatch(/safe.*suspicious.*malicious/);
  });

  it("biases toward 'suspicious' over 'malicious' on uncertainty", () => {
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain("prefer");
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain("suspicious");
  });

  it("identifies the email reviewer role (not URL reviewer)", () => {
    expect(EMAIL_CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain("email");
  });
});
