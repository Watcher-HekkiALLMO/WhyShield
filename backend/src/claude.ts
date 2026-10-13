import Anthropic from "@anthropic-ai/sdk";
import type { AnalyzeResponse, Reason } from "./types";

// Cheap, fast model for the URL pre-filter. The bigger Sonnet model will
// be used later for the side-panel "explain why" stream where copy quality
// matters more.
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are the URL safety reviewer for WhyShield, a Chrome extension that helps everyday users understand when a website might not be what it claims.

Your job: given a URL and a set of automated heuristic signals, decide if the page is likely safe, suspicious, or malicious, and write a calm two-sentence explanation a non-technical user can understand.

Tone rules (strict):
- Address the user in second person ("This site...").
- Do NOT use the words: attack, danger, threat, fraud, criminal.
- Prefer soft framings: "looks like", "appears to", "may not be the real X", "is a common phishing trick".
- The vibe is a knowledgeable friend looking over the user's shoulder, never an alarm.

Output rules (strict):
- Reply with ONLY a JSON object, no prose around it, no code fences.
- Schema: {"verdict": "safe"|"suspicious"|"malicious", "confidence": number 0..1, "explanation": string (1-2 sentences)}.
- If you're unsure, prefer "suspicious" over "malicious".`;

export interface ClaudeInput {
  url: string;
  host: string;
  heuristicHints: Reason[];
  apiKey: string;
}

interface ClaudeOutput {
  verdict: "safe" | "suspicious" | "malicious";
  confidence: number;
  explanation: string;
}

function buildUserMessage(input: ClaudeInput): string {
  const hints =
    input.heuristicHints.length === 0
      ? "(no heuristic signals fired)"
      : input.heuristicHints.map((r) => `- ${r.code}${r.detail ? `: ${r.detail}` : ""}`).join("\n");
  return `URL: ${input.url}
Host: ${input.host}

Heuristic signals from our pre-filter:
${hints}

Respond with the JSON object described in your instructions.`;
}

export async function classifyWithClaude(input: ClaudeInput): Promise<AnalyzeResponse> {
  const client = new Anthropic({ apiKey: input.apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    // No prompt caching here yet: Anthropic's cache requires a minimum
    // block size (~2048 tokens for Haiku) and our system prompt is only
    // a couple hundred tokens. Revisit if the prompt grows or we switch
    // this endpoint to Sonnet.
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
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

// If Claude misbehaves (down, returned non-JSON, etc.) fall back to a
// conservative "suspicious" verdict that surfaces whatever the heuristics
// already saw — better than failing the whole request.
function fallbackInconclusive(hints: Reason[]): AnalyzeResponse {
  return {
    verdict: "suspicious",
    confidence: 0.5,
    reasons: hints,
    explanation:
      "We couldn't fully check this site right now, so we're showing it as suspicious to be safe. You may want to double-check the address before continuing.",
  };
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0.5;
  return Math.max(0, Math.min(1, x));
}

// Some models like to wrap JSON in ```json ... ``` even when told not to.
function stripCodeFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
