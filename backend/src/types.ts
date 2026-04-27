// Shape of the JSON the extension sends to POST /analyze/url.
export interface AnalyzeUrlRequest {
  url: string;
}

// Shape of the JSON we send back. The same shape will be reused for the
// future POST /analyze/email endpoint so the extension has one renderer.
export interface AnalyzeResponse {
  verdict: Verdict;
  confidence: number; // 0..1
  reasons: Reason[];
  explanation: string;
}

export type Verdict = "safe" | "suspicious" | "malicious";

// A machine-readable tag for *why* we flagged something. The UI can map
// these to icons or learn-more links; `explanation` is the human copy.
export interface Reason {
  code: ReasonCode;
  detail?: string;
}

export type ReasonCode =
  | "typosquat-of-brand"
  | "suspicious-tld"
  | "ip-as-host"
  | "punycode-host"
  | "model-flagged"
  | "model-cleared";
