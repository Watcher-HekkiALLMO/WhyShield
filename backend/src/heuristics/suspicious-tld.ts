import type { Reason } from "../types";
import type { NormalizedUrl } from "./normalize";

// TLDs disproportionately abused by phishing kits. Sources at time of
// writing: Spamhaus "Most Abused TLDs", APWG quarterly reports, Cloudflare
// Radar. Plenty of legit sites live on these TLDs, so this fires as
// "suspicious", not "malicious" — it's a hint, not a verdict.
const SUSPICIOUS_TLDS = new Set([
  "zip",
  "mov",
  "xyz",
  "top",
  "click",
  "link",
  "support",
  // Historically free Freenom TLDs — still heavily abused even after
  // Freenom shut down new registrations.
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "country",
  "stream",
  "download",
  "loan",
  "men",
  "work",
  "rest",
  "buzz",
  "cyou",
  "monster",
]);

export interface TldHit {
  reason: Reason;
  confidence: number;
}

export function detectSuspiciousTld(n: NormalizedUrl): TldHit | null {
  const parts = n.host.split(".");
  const tld = parts[parts.length - 1];
  if (!tld) return null;
  if (SUSPICIOUS_TLDS.has(tld)) {
    return {
      reason: { code: "suspicious-tld", detail: tld },
      confidence: 0.55,
    };
  }
  return null;
}
