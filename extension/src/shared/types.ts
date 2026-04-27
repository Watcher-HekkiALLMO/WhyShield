// Mirrors /backend/src/types.ts. Kept in sync manually for now — when the
// extension and backend share more than this, we'll extract a shared types
// package.

export type Verdict = "safe" | "suspicious" | "malicious";

export type ReasonCode =
  | "typosquat-of-brand"
  | "suspicious-tld"
  | "ip-as-host"
  | "punycode-host"
  | "model-flagged"
  | "model-cleared";

export interface Reason {
  code: ReasonCode;
  detail?: string;
}

export interface AnalyzeResponse {
  verdict: Verdict;
  confidence: number;
  reasons: Reason[];
  explanation: string;
}

// What we cache in chrome.storage.local under verdict:<sha256(host+path)>.
export interface CachedVerdict {
  response: AnalyzeResponse;
  expiresAt: number; // ms epoch
}

// What we store under bypass:<host> when user clicks Continue Anyway.
export interface BypassEntry {
  expiresAt: number; // ms epoch
}
