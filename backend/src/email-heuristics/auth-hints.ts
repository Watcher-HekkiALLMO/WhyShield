import type { EmailHeaderHints, Reason } from "../types";

// SPF/DKIM/DMARC failures push toward suspicious but never short-circuit
// to conclusive — forwarded mail, mailing lists, and misconfigured-but-
// legit senders break these regularly. Each fail just adds a low-weight
// reason to the bundle Haiku considers.
//
// Pass-or-undefined is treated as "no signal" and emits nothing.

export function detectAuthFailures(hints: EmailHeaderHints | undefined): Reason[] {
  if (!hints) return [];
  const reasons: Reason[] = [];
  if (hints.spfPass === false) reasons.push({ code: "auth-spf-fail" });
  if (hints.dkimPass === false) reasons.push({ code: "auth-dkim-fail" });
  if (hints.dmarcPass === false) reasons.push({ code: "auth-dmarc-fail" });
  return reasons;
}
