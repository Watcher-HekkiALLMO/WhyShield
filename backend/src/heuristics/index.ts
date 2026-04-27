import type { AnalyzeResponse, Reason } from "../types";
import { detectIpHost } from "./ip-host";
import type { NormalizedUrl } from "./normalize";
import { detectPunycode } from "./punycode";
import { detectSuspiciousTld } from "./suspicious-tld";
import { detectTyposquat } from "./typosquat";

// Threshold above which a single heuristic is considered "conclusive" and
// short-circuits the Claude call. Tuned per Miguel's spec: a high-confidence
// heuristic alone is enough to mark the URL malicious.
const CONCLUSIVE_THRESHOLD = 0.85;

export interface HeuristicVerdict {
  conclusive: boolean;
  response: AnalyzeResponse | null;
  inconclusiveReasons: Reason[];
}

// Run all heuristics. If any single high-confidence heuristic fires, return
// a conclusive malicious verdict immediately. Otherwise collect lower-
// confidence reasons so the Claude call gets context to weigh.
export function runHeuristics(n: NormalizedUrl): HeuristicVerdict {
  const inconclusive: Reason[] = [];

  const typo = detectTyposquat(n);
  if (typo && typo.confidence >= CONCLUSIVE_THRESHOLD) {
    return conclusive(typo.reason, typo.confidence, explainTyposquat(typo.reason.detail!, n.host));
  }
  if (typo) inconclusive.push(typo.reason);

  const ip = detectIpHost(n);
  if (ip && ip.confidence >= CONCLUSIVE_THRESHOLD) {
    return conclusive(
      ip.reason,
      ip.confidence,
      "This link points to a numeric IP address instead of a domain name. Real services almost never do that, which is why this looks like a phishing page.",
    );
  }
  if (ip) inconclusive.push(ip.reason);

  const tld = detectSuspiciousTld(n);
  if (tld) inconclusive.push(tld.reason);

  const puny = detectPunycode(n);
  if (puny) inconclusive.push(puny.reason);

  return { conclusive: false, response: null, inconclusiveReasons: inconclusive };
}

function conclusive(reason: Reason, confidence: number, explanation: string): HeuristicVerdict {
  return {
    conclusive: true,
    response: { verdict: "malicious", confidence, reasons: [reason], explanation },
    inconclusiveReasons: [],
  };
}

function explainTyposquat(brand: string, host: string): string {
  return `This site (${host}) looks one character off from ${brand}, which is a common phishing trick. It may not be the real ${brand}.`;
}
