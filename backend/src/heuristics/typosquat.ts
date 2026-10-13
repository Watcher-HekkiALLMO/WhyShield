import { BRAND_DOMAINS } from "../brands";
import type { Reason } from "../types";
import type { NormalizedUrl } from "./normalize";
import { foldHomoglyphs } from "./normalize";

export interface TyposquatHit {
  reason: Reason;
  confidence: number;
}

// Damerau-Levenshtein: like Levenshtein, but counts a swap of two adjacent
// characters as one edit instead of two. That's why "paypla" reads as
// 1 edit from "paypal" — pure Levenshtein would call it 2 and miss it.
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1, // deletion
        d[i]![j - 1]! + 1, // insertion
        d[i - 1]![j - 1]! + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + cost);
      }
    }
  }
  return d[m]![n]!;
}

// Strip a leading "www." so "www.paypa1.com" compares the same way
// "paypa1.com" does.
function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

// Pragmatic shortcut for "registrable domain" without shipping a full
// public-suffix list. Take the last two labels for most TLDs, last three
// for the multi-part TLDs we explicitly know about. Brand list uses the
// same shape so they match.
const MULTI_PART_TLDS = new Set(["co.uk", "co.jp", "co.kr", "co.in", "com.au", "com.br", "com.mx"]);

function registrableDomain(host: string): string {
  const parts = host.split(".");
  if (parts.length < 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  if (parts.length >= 3 && MULTI_PART_TLDS.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

// Detect if the host looks like a typo of one of our protected brand
// domains. Conclusive (high confidence) when the registrable domain is
// exactly 1 edit from a brand AND not equal to it.
//
// Distance 1 only — distance 2 catches too many false positives
// (legitimate sites that happen to share a few letters). Distance 1 is
// the classic typosquat sweet spot ("paypa1.com", "paypol.com",
// "paypall.com").
export function detectTyposquat(n: NormalizedUrl): TyposquatHit | null {
  const candidate = foldHomoglyphs(stripWww(n.host));
  const candidateReg = registrableDomain(candidate);

  for (const brand of BRAND_DOMAINS) {
    if (candidateReg === brand) return null; // exact match → not a typo
    if (editDistance(candidateReg, brand) === 1) {
      return {
        reason: { code: "typosquat-of-brand", detail: brand },
        confidence: 0.95,
      };
    }
  }
  return null;
}
