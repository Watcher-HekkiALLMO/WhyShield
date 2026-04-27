import type { Reason } from "../types";
import type { NormalizedUrl } from "./normalize";

export interface PunycodeHit {
  reason: Reason;
  confidence: number;
}

// Punycode (xn--...) labels are how Unicode hostnames get encoded for DNS.
// Legit international domains use them, so this fires as "suspicious", not
// "malicious". The typosquat heuristic separately checks whether the
// decoded form is impersonating a brand and escalates if so.
export function detectPunycode(n: NormalizedUrl): PunycodeHit | null {
  if (!n.isPunycode) return null;
  return {
    reason: { code: "punycode-host", detail: n.host },
    confidence: 0.6,
  };
}
