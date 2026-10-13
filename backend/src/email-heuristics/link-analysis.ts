import { runHeuristics } from "../heuristics";
import { normalizeUrl } from "../heuristics/normalize";
import type { Reason, ReasonCode } from "../types";

// Reuse the URL heuristics layer for every link in the email body. If
// any single link fires conclusively at the URL level (typosquat, IP-
// as-host), bubble that up to the email level as conclusive malicious.
// Otherwise collect the inconclusive reasons so they accumulate into the
// signal bundle Haiku receives.
//
// Reason codes from runHeuristics get prefixed with "link-" so the
// explanation prompt knows the heuristic fired on a link inside the
// email, not on a URL the user navigated to. The original detail is
// preserved and the offending link is appended.

export interface LinkAnalysisResult {
  conclusive: boolean;
  conclusiveReason: Reason | null;
  conclusiveExplanation: string | null;
  inconclusiveReasons: Reason[];
}

export function analyzeLinks(links: readonly string[]): LinkAnalysisResult {
  const inconclusive: Reason[] = [];

  for (const link of links) {
    const n = normalizeUrl(link);
    if (!n) continue;

    const heur = runHeuristics(n);

    if (heur.conclusive && heur.response) {
      const original = heur.response.reasons[0];
      if (original) {
        return {
          conclusive: true,
          conclusiveReason: emailifyReason(original, link),
          conclusiveExplanation: explainConclusiveLink(original.code),
          inconclusiveReasons: [],
        };
      }
    }

    for (const r of heur.inconclusiveReasons) {
      inconclusive.push(emailifyReason(r, link));
    }
  }

  return {
    conclusive: false,
    conclusiveReason: null,
    conclusiveExplanation: null,
    inconclusiveReasons: inconclusive,
  };
}

function emailifyReason(r: Reason, link: string): Reason {
  const code = emailifyReasonCode(r.code);
  const detail = r.detail ? `${r.detail} (in link: ${link})` : `(in link: ${link})`;
  return { code, detail };
}

function emailifyReasonCode(code: ReasonCode): ReasonCode {
  switch (code) {
    case "typosquat-of-brand":
      return "link-typosquat-of-brand";
    case "ip-as-host":
      return "link-ip-as-host";
    case "suspicious-tld":
      return "link-suspicious-tld";
    case "punycode-host":
      return "link-punycode-host";
    default:
      return code;
  }
}

// Tone-compliant copy for the conclusive case. No banned words; soft
// framings. Mirrors the style of the URL conclusive explanations in
// heuristics/index.ts.
function explainConclusiveLink(code: ReasonCode): string {
  if (code === "typosquat-of-brand") {
    return "This email contains a link that looks one character off from a real brand's address — a common phishing trick. Even though the message itself looks normal, that mismatch is reason enough to treat the message as a likely impersonation.";
  }
  if (code === "ip-as-host") {
    return "This email contains a link that points to a numeric IP address instead of a domain name. Real services almost never do that, which is why this email looks like a phishing message.";
  }
  return "This email contains a link that matches a known phishing pattern. It looks like an impersonation message.";
}
