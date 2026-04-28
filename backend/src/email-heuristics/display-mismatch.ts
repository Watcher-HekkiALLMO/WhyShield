import { REGULATED_BRANDS, type RegulatedBrand } from "../email-brands";
import { editDistance } from "../heuristics/typosquat";
import type { Reason } from "../types";
import type { ParsedFrom } from "./parse-from";

// Detect display-name spoofing of a regulated brand.
//
// Logic (per session 4 spec):
//   - Display name mentions a regulated brand (word-boundary case-
//     insensitive match on humanName) AND
//   - From host is NOT the brand's domain (or a subdomain of it) AND
//   - From host is NOT a 1-edit typosquat of the brand's domain
//   → conclusive malicious.
//
// The "neither real nor typosquat" wording is deliberate: the typosquat
// case isn't this heuristic's responsibility. Legitimate mail comes from
// brand-owned domains, full stop.

export interface DisplayMismatchHit {
  reason: Reason;
  confidence: number;
  conclusive: boolean;
  brand: RegulatedBrand;
}

export function detectDisplayMismatch(parsed: ParsedFrom): DisplayMismatchHit | null {
  if (!parsed.displayName) return null;

  for (const brand of REGULATED_BRANDS) {
    if (!mentionsBrand(parsed.displayName, brand.humanName)) continue;
    if (hostBelongsToDomain(parsed.host, brand.domain)) return null; // legit
    if (isOneEditTyposquat(parsed.host, brand.domain)) return null; // not our case
    return {
      reason: {
        code: "display-name-spoof",
        detail: `claims ${brand.humanName}, sent from ${parsed.host}`,
      },
      confidence: 0.95,
      conclusive: true,
      brand,
    };
  }
  return null;
}

// Word-boundary case-insensitive match. Avoids matching "Apple" inside
// "PineApple" or "Visa" inside "visualization".
function mentionsBrand(text: string, humanName: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(humanName)}\\b`, "i");
  return pattern.test(text);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Is `host` the brand's own domain or a subdomain of it? "paypal.com"
// matches, "service.paypal.com" matches, "evil-paypal.com" does not.
export function hostBelongsToDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

// Compare the registrable-domain-ish form (last two labels) against the
// brand domain. Distance 1 catches the classic typosquat pattern; higher
// distances open too many false positives.
function isOneEditTyposquat(host: string, domain: string): boolean {
  const parts = host.split(".");
  if (parts.length < 2) return false;
  const candidate = parts.slice(-2).join(".");
  if (candidate === domain) return false;
  return editDistance(candidate, domain) === 1;
}
