import Anthropic from "@anthropic-ai/sdk";
import type { SSEStreamingApi } from "hono/streaming";
import type { ExplainUrlRequest, Reason } from "./types";

// Sonnet 4.6 — current latest at time of writing per the env note. The
// non-dated alias resolves to the most recent stable; we'll pin to a
// dated version when we deploy to production for reproducibility.
export const EXPLAIN_MODEL = "claude-sonnet-4-6";

// Static fallback if the model is unreachable. Same tone rules as the
// streaming output, just shorter and pre-written.
export const FALLBACK_TEXT =
  "We couldn't load a detailed explanation right now, so here's the short version. The summary on the warning page is what we know: this site shows signs of a common phishing trick. If you weren't expecting to land here, the safest move is to go back. You can try again in a moment.";

// System prompt is the educational counterpart to the classification
// prompt in claude.ts — different shape (paragraphs, not JSON), different
// goal (teach the user, not classify). Tone rules duplicated here rather
// than imported because the prompt reads as one cohesive piece of copy.
export const SYSTEM_PROMPT = `You are the safety educator for a Chrome extension that helps everyday users understand when a website might not be what it claims.

Your job: given a URL and the heuristic signals our pre-filter found, write a calm, plain-English educational explanation a non-technical user can read in under a minute. Address the user directly in second person.

Structure (always 2-3 short paragraphs separated by a blank line):
1. What is specifically off about THIS URL — point at the exact pattern (e.g. one letter different from the real brand, an unusual TLD, an IP-as-host) and explain it concretely.
2. The wider pattern this represents and how to spot it elsewhere — what should the user look for in the future when they see a link like this?
3. Optional one short sentence on what to do right now (close the tab, type the address yourself, etc.). Skip this paragraph if the first two cover it.

Tone rules (strict):
- Second person ("This site...", "What this typically means...", "You can spot...").
- Calm, like a knowledgeable friend looking over the user's shoulder. Never alarmist.
- DO NOT use the words: attack, danger, threat, fraud, criminal.
- Prefer soft framings: "looks like", "appears to", "is a common phishing trick", "may not be the real X".
- Do not name the product. Do not start with greetings or restatements of the question.
- Do not output JSON, headings, bullet lists, or markdown. Just plain paragraphs separated by a blank line.`;

export function buildUserMessage(input: ExplainUrlRequest): string {
  const reasons = input.reasons
    .map((r) => `- ${r.code}${r.detail ? `: ${r.detail}` : ""}`)
    .join("\n");
  return `URL: ${input.url}
Verdict: ${input.verdict} (confidence ${input.confidence.toFixed(2)})

Heuristic signals from our pre-filter:
${reasons || "(none)"}

Write the explanation now, following the structure and tone rules in your instructions.`;
}

// Shallow shape validation — this endpoint is only called by our extension,
// so we don't deeply validate every Reason. If our extension sends bad
// input the model will still produce a verbose response; acceptable cost.
export function validateExplainRequest(body: unknown): ExplainUrlRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.url !== "string" || b.url.length === 0) return null;
  if (typeof b.verdict !== "string") return null;
  if (typeof b.confidence !== "number") return null;
  if (!Array.isArray(b.reasons)) return null;
  return {
    url: b.url,
    verdict: b.verdict as ExplainUrlRequest["verdict"],
    confidence: b.confidence,
    reasons: b.reasons as Reason[],
  };
}

// Stream a Sonnet explanation as SSE deltas, with a static fallback if
// the model call throws. SSE shape: each text delta sent as
// `data: ${JSON.stringify(text)}\n\n` (JSON-encoded so newlines and quotes
// survive); stream ends with `data: [DONE]\n\n`.
//
// Decoupled from the Hono Context so the same function will work for
// /explain/email later — only buildUserMessage and the validator change.
export async function streamExplanation(
  stream: SSEStreamingApi,
  apiKey: string,
  input: ExplainUrlRequest,
): Promise<void> {
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: EXPLAIN_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
      stream: true,
    });
    for await (const event of response) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        await stream.writeSSE({ data: JSON.stringify(event.delta.text) });
      }
    }
  } catch {
    await stream.writeSSE({ data: JSON.stringify(FALLBACK_TEXT) });
  }
  await stream.writeSSE({ data: "[DONE]" });
}
