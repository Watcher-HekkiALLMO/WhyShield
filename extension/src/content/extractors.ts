// DOM extractors for the Gmail content script.
//
// Anchored on these Gmail selectors (all stable for years; semantic over
// class-name where possible). When Gmail drifts, look here first:
//
//   [role="main"]                       — conversation pane root
//   [data-legacy-message-id]            — Gmail API message ID (preferred)
//   [data-message-id]                   — Gmail internal id (fallback)
//   .a3s                                — rendered message body container
//   .gmail_quote, blockquote.gmail_quote — quoted reply chain to strip
//   .gmail_extra                         — signatures/below-quote padding
//   [email][name]                        — sender attribution span (the
//                                          first one within a message div
//                                          is the From; To/Cc only appear
//                                          inside the expandable details)
//   [role="main"] h2                     — conversation subject
//
// Reply-To is intentionally NOT extracted in v1: it lives behind Gmail's
// "show details" expand-arrow and isn't in the default DOM. The backend's
// `replyTo` field stays optional and the heuristic just doesn't fire.
// Captured in CLAUDE.md "Known v2 priorities" if not already.

export function extractMessageId(msgEl: Element): string | null {
  return msgEl.getAttribute("data-legacy-message-id") || msgEl.getAttribute("data-message-id");
}

// "Display Name <addr@host>" or just "addr@host" if no display name. The
// backend's parseFromHeader handles both.
export function extractSender(msgEl: Element): string | null {
  const span = msgEl.querySelector<HTMLElement>("[email]");
  if (!span) return null;
  const email = (span.getAttribute("email") || "").trim();
  if (!email) return null;
  const name = (span.getAttribute("name") || "").trim() || (span.textContent || "").trim();
  return name && name !== email ? `${name} <${email}>` : email;
}

export function extractSubject(): string {
  const h2 = document.querySelector<HTMLHeadingElement>("[role='main'] h2");
  return (h2?.textContent || "").trim();
}

// Body text with the quoted reply chain stripped — we want to analyze the
// CURRENT message, not the conversation history below it. Whitespace
// normalized so the backend's prompt isn't dominated by Gmail's HTML
// indentation.
export function extractBody(msgEl: Element): string {
  const body = msgEl.querySelector(".a3s");
  if (!body) return "";
  const cleaned = stripQuotes(body);
  return (cleaned.textContent || "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Hrefs of all <a> tags in the body, excluding Gmail UI / mailto / tel /
// in-doc anchors. Gmail wraps every outbound link as
// https://www.google.com/url?q=<original> for click-tracking — we unwrap
// to the original URL because that's what the user would actually visit
// (and what the backend's heuristics need to see).
export function extractLinks(msgEl: Element): string[] {
  const body = msgEl.querySelector(".a3s");
  if (!body) return [];
  const cleaned = stripQuotes(body);
  const out = new Set<string>();
  for (const a of cleaned.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = (a.getAttribute("href") || "").trim();
    if (!href) continue;
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    const unwrapped = unwrapGoogleRedirect(href);
    if (!/^https?:/i.test(unwrapped)) continue;
    out.add(unwrapped);
  }
  return [...out];
}

function stripQuotes(body: Element): Element {
  const clone = body.cloneNode(true) as Element;
  for (const q of clone.querySelectorAll(".gmail_quote, blockquote.gmail_quote, .gmail_extra")) {
    q.remove();
  }
  return clone;
}

function unwrapGoogleRedirect(href: string): string {
  try {
    const u = new URL(href);
    if (u.hostname !== "www.google.com" || u.pathname !== "/url") return href;
    return u.searchParams.get("q") || u.searchParams.get("url") || href;
  } catch {
    return href;
  }
}
