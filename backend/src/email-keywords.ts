// Phrase lists for the urgency and credential-request scans.
//
// Design principle (per project charter): lean toward false negatives.
// Legitimate transactional emails are often urgent ("your flight leaves
// in 2 hours"), so single words like "urgent" or "verify" by themselves
// would over-fire. Each entry below is a multi-word phrase that's
// disproportionately phishy in real corpora.
//
// Match is case-insensitive substring (see keyword-scan.ts). These hits
// are inconclusive on their own — they accumulate into the signal bundle
// that gets passed to Haiku. They never short-circuit.
//
// To tune: edit this file in isolation. The heuristics in
// email-heuristics/keyword-scan.ts don't need to know what changed.

export const URGENCY_KEYWORDS: readonly string[] = [
  "verify immediately",
  "verify your account immediately",
  "account suspended",
  "account has been suspended",
  "account will be suspended",
  "account will be locked",
  "account will be closed",
  "account will be terminated",
  "account has been limited",
  "urgent action required",
  "immediate action required",
  "action required within",
  "act now to avoid",
  "failure to act",
  "failure to verify",
  "final notice",
  "final warning",
  "last warning",
  "last chance to verify",
  "we have detected unusual activity",
  "suspicious activity on your account",
  "unauthorized login attempt",
  "your access will be revoked",
  "to avoid suspension",
  "to avoid account closure",
];

export const CREDENTIAL_REQUEST_KEYWORDS: readonly string[] = [
  "verify your password",
  "confirm your password",
  "update your password",
  "re-enter your password",
  "reenter your password",
  "verify your login",
  "confirm your login credentials",
  "verify your identity",
  "confirm your identity by",
  "enter your social security number",
  "confirm your social security",
  "verify your social security",
  "verify your full credit card",
  "confirm your card details",
  "confirm your billing information",
  "update your billing information",
  "verify your banking information",
  "verify your account details",
  "confirm your account details",
  "validate your account",
  "re-validate your account",
  "click here to verify",
  "click below to verify",
  "click here to confirm",
];
