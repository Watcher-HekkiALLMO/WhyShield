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
  | "model-cleared"
  // Email-specific codes. The "link-*" prefixes mark URL heuristics that
  // fired on a link inside an email body, so the explanation prompt can
  // render "the link in this email" copy instead of "this site".
  | "display-name-spoof"
  | "reply-to-mismatch"
  | "urgency-language"
  | "credential-request-language"
  | "free-email-brand-impersonation"
  | "link-typosquat-of-brand"
  | "link-ip-as-host"
  | "link-suspicious-tld"
  | "link-punycode-host"
  | "auth-spf-fail"
  | "auth-dkim-fail"
  | "auth-dmarc-fail"
  | "unparseable-from";

// Input to POST /explain/url. The extension constructs this from a prior
// /analyze/url verdict response.
export interface ExplainUrlRequest {
  url: string;
  verdict: Verdict;
  confidence: number;
  reasons: Reason[];
}

// Optional auth hints the extension can pass through if it managed to read
// the Authentication-Results header. Each is true on pass, false on fail,
// undefined when the header didn't carry that check. Failure is suspicious,
// never conclusive on its own — forwarded mail and mailing lists break
// these checks regularly without being phishing.
export interface EmailHeaderHints {
  spfPass?: boolean;
  dkimPass?: boolean;
  dmarcPass?: boolean;
}

// Shape of the JSON the extension sends to POST /analyze/email. The Gmail
// content script (built later) is responsible for assembling this.
export interface AnalyzeEmailRequest {
  from: string;
  replyTo?: string;
  subject: string;
  body: string;
  links: string[];
  headerHints?: EmailHeaderHints;
}

// Input to POST /explain/email. Mirrors ExplainUrlRequest: the original
// email fields plus the verdict/reasons we already returned.
export interface ExplainEmailRequest {
  from: string;
  replyTo?: string;
  subject: string;
  body: string;
  links: string[];
  headerHints?: EmailHeaderHints;
  verdict: Verdict;
  confidence: number;
  reasons: Reason[];
}
