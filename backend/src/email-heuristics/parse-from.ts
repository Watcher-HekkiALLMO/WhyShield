// Parse the From / Reply-To header into display name + email + host.
//
// RFC 5322 supports a few address forms; we cover the three that show up
// in practice:
//
//   1. `addr@host`                    (bare)
//   2. `<addr@host>`                  (angle-bracketed, no display)
//   3. `Display Name <addr@host>`     (display + angle-bracketed)
//   4. `"Quoted Display" <addr@host>` (quoted display + angle-bracketed)
//
// We don't handle group syntax ("undisclosed-recipients:;"), comments in
// parens, or multiple addresses. Phishing mail almost never uses those.
// On any malformed input we return null and let the caller decide how to
// react — the orchestrator surfaces an `unparseable-from` reason.

export interface ParsedFrom {
  displayName: string | null;
  email: string;
  host: string; // lowercased, no port
}

export function parseFromHeader(raw: string): ParsedFrom | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Forms 2-4: anything ending in `<...>`.
  const angleMatch = trimmed.match(/^(?:"([^"]*)"|([^<]*?))?\s*<\s*([^>\s]+)\s*>$/);
  if (angleMatch) {
    const display = (angleMatch[1] ?? angleMatch[2] ?? "").trim();
    const email = angleMatch[3]!.toLowerCase();
    const host = hostFromEmail(email);
    if (!host) return null;
    return { displayName: display.length > 0 ? display : null, email, host };
  }

  // Form 1: bare addr@host.
  if (trimmed.includes("@") && !trimmed.includes(" ")) {
    const email = trimmed.toLowerCase();
    const host = hostFromEmail(email);
    if (!host) return null;
    return { displayName: null, email, host };
  }

  return null;
}

function hostFromEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1);
}
