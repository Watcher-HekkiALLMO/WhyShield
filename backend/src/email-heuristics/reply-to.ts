import type { Reason } from "../types";
import { type ParsedFrom, parseFromHeader } from "./parse-from";

// Reply-To pointing to a different domain than From is a classic phishing
// pattern: the message looks like it came from support@bigbrand.com but
// any reply silently goes to attacker@randomdomain.com.
//
// Inconclusive only — plenty of legitimate setups do this (mailing lists
// route replies through their own infrastructure, support tools rewrite
// reply addresses, etc.). The signal is "worth Haiku looking at," not
// "definitely phishing."

export interface ReplyToHit {
  reason: Reason;
  confidence: number;
}

export function detectReplyToMismatch(
  from: ParsedFrom,
  replyTo: string | undefined,
): ReplyToHit | null {
  if (!replyTo || replyTo.trim().length === 0) return null;

  const parsed = parseFromHeader(replyTo);
  if (!parsed) return null;
  if (parsed.host === from.host) return null;

  // Same registrable domain (foo.brand.com vs reply.brand.com) shouldn't
  // fire — that's normal multi-subdomain corporate mail. Compare the
  // last two labels.
  if (lastTwoLabels(parsed.host) === lastTwoLabels(from.host)) return null;

  return {
    reason: {
      code: "reply-to-mismatch",
      detail: `from ${from.host}, reply-to ${parsed.host}`,
    },
    confidence: 0.45,
  };
}

function lastTwoLabels(host: string): string {
  const parts = host.split(".");
  if (parts.length < 2) return host;
  return parts.slice(-2).join(".");
}
