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
  | "model-cleared"
  // Email-specific codes (mirror /backend/src/types.ts).
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

// Context the side panel needs to start streaming an explanation.
// Discriminated union: "url" entries come from the warning interstitial;
// "email" entries come from the Gmail content script's banner. The side
// panel branches on `type` to decide which backend endpoint to hit and
// how to render the header.
//
// Written by the source page (via the background worker) into
// chrome.storage.session keyed by tab id, then consumed on read by the
// side panel.
export type ExplainContext = ExplainUrlContext | ExplainEmailContext;

export interface ExplainUrlContext {
  type: "url";
  url: string;
  verdict: Verdict;
  confidence: number;
  reasons: Reason[];
}

export interface ExplainEmailContext {
  type: "email";
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

// Optional auth hints the content script can pass through if it parsed
// the Authentication-Results header. Mirrors backend EmailHeaderHints.
export interface EmailHeaderHints {
  spfPass?: boolean;
  dkimPass?: boolean;
  dmarcPass?: boolean;
}

// Mirrors /backend/src/types.ts AnalyzeEmailRequest. The Gmail content
// script assembles this from extracted DOM data.
export interface AnalyzeEmailRequest {
  from: string;
  replyTo?: string;
  subject: string;
  body: string;
  links: string[];
  headerHints?: EmailHeaderHints;
}

// Per-message safe-list entry. No TTL: the user explicitly trusted this
// specific email, and that trust persists. Bypass is keyed strictly by
// data-message-id and does NOT propagate to replies, forwards, or other
// emails from the same sender — phishers exploit exactly that kind of
// inherited trust. (Same defensive scoping principle as the URL
// bypass-by-host rule.)
export interface EmailSafeEntry {
  markedAt: number; // ms epoch
}

// Cached email verdict. Same TTL as the URL verdict cache. Keyed by
// sha256(from + subject + body + sortedLinks) so the same message
// content (regardless of link order) hits one entry.
export interface CachedEmailVerdict {
  response: AnalyzeResponse;
  expiresAt: number; // ms epoch
}
