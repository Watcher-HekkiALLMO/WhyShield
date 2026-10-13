import Anthropic from "@anthropic-ai/sdk";
import type { AnalyzeEmailRequest, AnalyzeResponse, Reason } from "./types";

// Cheap pre-filter for inconclusive emails. Mirrors claude.ts (URL
// classifier) — same Haiku model, same JSON-only output contract — but
// the prompt and user message are email-shaped.
const MODEL = "claude-haiku-4-5-20251001";

// Hard cap on body length sent to the model. Phishing emails are usually
// short; truncating very long messages keeps Haiku cost predictable and
// prevents very long marketing emails from blowing the prompt budget.
// 4000 chars ≈ 1000 tokens, comfortably below the system prompt budget.
const MAX_BODY_CHARS = 4000;

const SYSTEM_PROMPT = `You are the email safety reviewer for WhyShield, a Chrome extension that helps everyday users recognize phishing emails.

Your job: given the parts of an email and a set of automated heuristic signals, decide if the message is likely safe, suspicious, or malicious, and write a calm two-sentence explanation a non-technical user can understand.

Tone rules (strict):
- Address the user in second person ("This email...").
- Do NOT use the words: attack, danger, threat, fraud, criminal.
- Prefer soft framings: "looks like", "appears to", "may not be from the real X", "is a common phishing trick".
- The vibe is a knowledgeable friend looking over the user's shoulder, never an alarm.

Output rules (strict):
- Reply with ONLY a JSON object, no prose around it, no code fences.
- Schema: {"verdict": "safe"|"suspicious"|"malicious", "confidence": number 0..1, "explanation": string (1-2 sentences)}.
- If you're unsure, prefer "suspicious" over "malicious".`;

export interface ClaudeEmailInput {
  request: AnalyzeEmailRequest;
  heuristicHints: Reason[];
  apiKey: string;
}

interface ClaudeOutput {
  verdict: "safe" | "suspicious" | "malicious";
  confidence: number;
  explanation: string;
}

export function buildEmailUserMessage(request: AnalyzeEmailRequest, hints: Reason[]): string {
  const hintLines =
    hints.length === 0
      ? "(no heuristic signals fired)"
      : hints.map((r) => `- ${r.code}${r.detail ? `: ${r.detail}` : ""}`).join("\n");

  const linkLines =
    request.links.length === 0 ? "(none)" : request.links.map((l) => `- ${l}`).join("\n");

  const bodyPreview =
    request.body.length > MAX_BODY_CHARS
      ? `${request.body.slice(0, MAX_BODY_CHARS)}\n[...truncated, original was ${request.body.length} chars]`
      : request.body;

  return `From: ${request.from}
Reply-To: ${request.replyTo ?? "(same as From)"}
Subject: ${request.subject}

Body:
${bodyPreview}

Links found in body:
${linkLines}

Heuristic signals from our pre-filter:
${hintLines}

Respond with the JSON object described in your instructions.`;
}

export async function classifyEmailWithClaude(input: ClaudeEmailInput): Promise<AnalyzeResponse> {
  const client = new Anthropic({ apiKey: input.apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildEmailUserMessage(input.request, input.heuristicHints) },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return fallbackInconclusive(input.heuristicHints);
  }

  let parsed: ClaudeOutput;
  try {
    parsed = JSON.parse(stripCodeFence(textBlock.text)) as ClaudeOutput;
  } catch {
    return fallbackInconclusive(input.heuristicHints);
  }

  return {
    verdict: parsed.verdict,
    confidence: clamp01(parsed.confidence),
    reasons: [
      ...input.heuristicHints,
      { code: parsed.verdict === "safe" ? "model-cleared" : "model-flagged" },
    ],
    explanation: parsed.explanation,
  };
}

// Conservative fallback if Haiku misbehaves. Same shape as the URL
// classifier's fallback but worded for email context.
function fallbackInconclusive(hints: Reason[]): AnalyzeResponse {
  return {
    verdict: "suspicious",
    confidence: 0.5,
    reasons: hints,
    explanation:
      "We couldn't fully check this email right now, so we're flagging it as suspicious to be safe. You may want to look more carefully at the sender address before clicking any links.",
  };
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}

function stripCodeFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// Re-exported for tests so they can grep tone rules without importing
// the file's internals directly.
export { SYSTEM_PROMPT as EMAIL_CLASSIFIER_SYSTEM_PROMPT };
