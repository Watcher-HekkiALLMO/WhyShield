import { URGENCY_KEYWORDS, CREDENTIAL_REQUEST_KEYWORDS } from "../email-keywords";
import type { AnalyzeEmailRequest, AnalyzeResponse, Reason } from "../types";
import { detectAuthFailures } from "./auth-hints";
import { detectDisplayMismatch } from "./display-mismatch";
import { detectFreeEmailImpersonation } from "./free-email-impersonation";
import { scanKeywords } from "./keyword-scan";
import { analyzeLinks } from "./link-analysis";
import { parseFromHeader } from "./parse-from";
import { detectReplyToMismatch } from "./reply-to";

// Run every email heuristic. If any conclusive signal fires, return a
// fully-formed malicious response immediately and skip Haiku. Otherwise
// collect inconclusive reasons for Haiku to weigh.
//
// Order matters: link analysis runs first because (a) typosquatted links
// are the cleanest possible phishing signal, and (b) it short-circuits
// cheaply without needing the parsed From header.

export interface EmailHeuristicVerdict {
  conclusive: boolean;
  response: AnalyzeResponse | null;
  inconclusiveReasons: Reason[];
}

export function runEmailHeuristics(input: AnalyzeEmailRequest): EmailHeuristicVerdict {
  const inconclusive: Reason[] = [];

  // Conclusive (a): a link in the body trips a conclusive URL heuristic.
  const linkResult = analyzeLinks(input.links);
  if (linkResult.conclusive && linkResult.conclusiveReason) {
    return {
      conclusive: true,
      response: {
        verdict: "malicious",
        confidence: 0.95,
        reasons: [linkResult.conclusiveReason],
        explanation:
          linkResult.conclusiveExplanation ??
          "This email contains a link that matches a known phishing pattern.",
      },
      inconclusiveReasons: [],
    };
  }
  inconclusive.push(...linkResult.inconclusiveReasons);

  // From-header parsing happens before any From-dependent heuristic.
  // Unparseable From is suspicious but not conclusive — let Haiku see it.
  const fromParsed = parseFromHeader(input.from);
  if (!fromParsed) {
    inconclusive.push({ code: "unparseable-from", detail: input.from.slice(0, 120) });
    return finishInconclusive(input, inconclusive);
  }

  // Conclusive (b): display-name spoofing of a regulated brand from an
  // unrelated host.
  const displaySpoof = detectDisplayMismatch(fromParsed);
  if (displaySpoof?.conclusive) {
    return {
      conclusive: true,
      response: {
        verdict: "malicious",
        confidence: displaySpoof.confidence,
        reasons: [displaySpoof.reason],
        explanation: explainDisplaySpoof(displaySpoof.brand.humanName, fromParsed.host),
      },
      inconclusiveReasons: [],
    };
  }

  // From here down, every signal is inconclusive. Accumulate them and
  // hand the bundle to whoever runs Haiku.
  const reply = detectReplyToMismatch(fromParsed, input.replyTo);
  if (reply) inconclusive.push(reply.reason);

  const text = `${input.subject}\n${input.body}`;

  const urgency = scanKeywords(text, URGENCY_KEYWORDS);
  if (urgency) {
    inconclusive.push({
      code: "urgency-language",
      detail: urgency.matched.slice(0, 3).join(", "),
    });
  }

  const cred = scanKeywords(text, CREDENTIAL_REQUEST_KEYWORDS);
  if (cred) {
    inconclusive.push({
      code: "credential-request-language",
      detail: cred.matched.slice(0, 3).join(", "),
    });
  }

  const free = detectFreeEmailImpersonation(fromParsed, input.subject);
  if (free) inconclusive.push(free.reason);

  inconclusive.push(...detectAuthFailures(input.headerHints));

  return finishInconclusive(input, inconclusive);
}

function finishInconclusive(
  _input: AnalyzeEmailRequest,
  reasons: Reason[],
): EmailHeuristicVerdict {
  return { conclusive: false, response: null, inconclusiveReasons: reasons };
}

// Tone-compliant copy for the display-spoof conclusive case. Soft
// framings, second person, no banned words.
function explainDisplaySpoof(brand: string, host: string): string {
  return `The sender name on this email mentions ${brand}, but the address it actually came from (${host}) doesn't belong to ${brand}. Legitimate ${brand} email comes from their own domain, so this looks like a common impersonation pattern.`;
}
