import type { ExplainEmailRequest, Reason } from "./types";

// Educational explanation prompt for /explain/email. Mirrors the URL
// version in explain.ts: same 2-3 paragraph structure, same tone rules,
// but the prompt and user message are tailored to email signals (display
// name, From host, links inside the body, urgency phrases).
//
// Intentionally NOT importing from explain.ts — the prompts are sibling
// pieces of copy that should be edited independently. The streaming call
// in explain.ts will be parameterized in turn B so /explain/email can
// reuse it with this prompt + builder.

export const SYSTEM_PROMPT_EMAIL = `You are the safety educator for a Chrome extension that helps everyday users understand when an email might not be what it claims.

Your job: given the parts of an email and the heuristic signals our pre-filter found, write a calm, plain-English educational explanation a non-technical user can read in under a minute. Address the user directly in second person.

Structure (always 2-3 short paragraphs separated by a blank line):
1. What is specifically off about THIS email — point at the exact pattern (display name doesn't match the sending address, a link inside the email looks one letter off from a real brand, the message uses pressure phrases that push for quick action, the sender is a personal email account claiming to be a bank, etc.) and explain it concretely using the actual From address, subject, or link from the email.
2. The wider pattern this represents and how to spot it elsewhere — what should the user look for in the future when they see an email like this?
3. Optional one short sentence on what to do right now (don't click links in the email, type the brand's address yourself in a new tab, contact the brand through their official app, etc.). Skip this paragraph if the first two cover it.

Tone rules (strict):
- Second person ("This email...", "What this typically means...", "You can spot...").
- Calm, like a knowledgeable friend looking over the user's shoulder. Never alarmist.
- DO NOT use the words: attack, danger, threat, fraud, criminal.
- Prefer soft framings: "looks like", "appears to", "is a common phishing trick", "may not be from the real X".
- Do not name the product. Do not start with greetings or restatements of the question.
- Do not output JSON, headings, bullet lists, or markdown. Just plain paragraphs separated by a blank line.`;

// Static fallback rendered when the model is unreachable. Same tone
// rules, just shorter and pre-written. Mirrors FALLBACK_TEXT in
// explain.ts; the streaming layer emits this as a single SSE chunk so
// clients render it identically to a real stream.
export const FALLBACK_TEXT_EMAIL =
  "We couldn't load a detailed explanation right now, so here's the short version. The summary on the warning banner is what we know: this email shows signs of a common phishing trick. If you weren't expecting the message, the safest move is to avoid clicking any links and to contact the sender through their official app or website instead.";

const MAX_BODY_CHARS = 4000;

export function buildEmailUserMessage(input: ExplainEmailRequest): string {
  const reasonLines =
    input.reasons.length === 0
      ? "(none)"
      : input.reasons.map((r) => `- ${r.code}${r.detail ? `: ${r.detail}` : ""}`).join("\n");

  const linkLines =
    input.links.length === 0 ? "(none)" : input.links.map((l) => `- ${l}`).join("\n");

  const bodyPreview =
    input.body.length > MAX_BODY_CHARS
      ? `${input.body.slice(0, MAX_BODY_CHARS)}\n[...truncated, original was ${input.body.length} chars]`
      : input.body;

  return `From: ${input.from}
Reply-To: ${input.replyTo ?? "(same as From)"}
Subject: ${input.subject}
Verdict: ${input.verdict} (confidence ${input.confidence.toFixed(2)})

Body:
${bodyPreview}

Links found in body:
${linkLines}

Heuristic signals from our pre-filter:
${reasonLines}

Write the explanation now, following the structure and tone rules in your instructions.`;
}

// Shallow shape validation. The endpoint is only called by our extension,
// so we don't deeply validate every Reason — same trade-off as
// validateExplainRequest in explain.ts.
export function validateExplainEmailRequest(body: unknown): ExplainEmailRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  if (typeof b.from !== "string" || b.from.length === 0) return null;
  if (b.replyTo !== undefined && typeof b.replyTo !== "string") return null;
  if (typeof b.subject !== "string") return null;
  if (typeof b.body !== "string") return null;
  if (!Array.isArray(b.links)) return null;
  if (typeof b.verdict !== "string") return null;
  if (typeof b.confidence !== "number") return null;
  if (!Array.isArray(b.reasons)) return null;
  if (
    b.headerHints !== undefined &&
    (typeof b.headerHints !== "object" || b.headerHints === null)
  ) {
    return null;
  }

  return {
    from: b.from,
    replyTo: b.replyTo as string | undefined,
    subject: b.subject,
    body: b.body,
    links: b.links as string[],
    headerHints: b.headerHints as ExplainEmailRequest["headerHints"],
    verdict: b.verdict as ExplainEmailRequest["verdict"],
    confidence: b.confidence,
    reasons: b.reasons as Reason[],
  };
}
