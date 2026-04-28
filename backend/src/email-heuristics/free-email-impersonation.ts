import { FREE_EMAIL_PROVIDERS, REGULATED_BRANDS } from "../email-brands";
import type { Reason } from "../types";
import type { ParsedFrom } from "./parse-from";

// "From is a personal email provider AND display/subject mentions a
// regulated brand." Banks, the IRS, FedEx etc. don't send mail from
// gmail.com — when they appear to, it's almost always impersonation.
//
// Inconclusive (high-ish confidence) rather than conclusive: a friend
// forwarding a Capital One promo from their own gmail would technically
// trip this. Haiku gets the final say.
//
// Note: display-name spoof of a regulated brand fires conclusively
// before this heuristic runs, so this only fires when display is empty
// or generic but the brand name appears in the subject.

export interface FreeEmailImpersonationHit {
  reason: Reason;
  confidence: number;
}

export function detectFreeEmailImpersonation(
  parsed: ParsedFrom,
  subject: string,
): FreeEmailImpersonationHit | null {
  if (!FREE_EMAIL_PROVIDERS.has(parsed.host)) return null;

  const haystack = `${parsed.displayName ?? ""} ${subject}`;
  for (const brand of REGULATED_BRANDS) {
    if (mentionsBrand(haystack, brand.humanName)) {
      return {
        reason: {
          code: "free-email-brand-impersonation",
          detail: `${parsed.host} sender mentions ${brand.humanName}`,
        },
        confidence: 0.7,
      };
    }
  }
  return null;
}

function mentionsBrand(text: string, humanName: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(humanName)}\\b`, "i");
  return pattern.test(text);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
