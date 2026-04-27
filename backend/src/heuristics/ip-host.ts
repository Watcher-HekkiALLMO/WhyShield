import type { Reason } from "../types";
import type { NormalizedUrl } from "./normalize";

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export interface IpHostHit {
  reason: Reason;
  confidence: number;
}

// Legit consumer-facing services use domain names, not bare IPs. A bare IP
// on a login or banking-shaped URL is nearly always credential phishing or
// a malware drop, so this is treated as conclusive.
export function detectIpHost(n: NormalizedUrl): IpHostHit | null {
  // url.hostname keeps brackets around IPv6 addresses; strip them so the
  // detail field is human-readable.
  const host = n.host;
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const isIpv4 = IPV4_RE.test(bare);
  // Cheap IPv6 sniff: contains a colon and no dots. Good enough — we just
  // need to recognize "this is an IP," not validate the address.
  const isIpv6 = bare.includes(":") && !bare.includes(".");
  if (!isIpv4 && !isIpv6) return null;
  return {
    reason: { code: "ip-as-host", detail: bare },
    confidence: 0.9,
  };
}
