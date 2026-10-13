import type { AnalyzeResponse, Reason, ReasonCode } from "../shared/types";

// Stable attribute marker on the banner host element. Used for de-dupe
// (one banner per message), removal (Mark as safe / Dismiss), and
// scoping (queries from gmail.ts find their own injected nodes).
const BANNER_ATTR = "data-whyshield-banner";

export interface BannerCallbacks {
  onExplain: () => void;
  onMarkSafe: () => void;
  onDismiss: () => void;
}

// Inject the warning banner above the message body. Uses Shadow DOM so
// (a) Gmail's CSS can't bleed in and shift our layout, and (b) our CSS
// can't escape and break Gmail's reading area. Returns the host element
// the caller can hold a reference to for later removal.
//
// Banner placement: just before the .a3s body container, inside the
// message div. Sits in document flow (no fixed positioning), pushes the
// body content down by its own height.
export function injectBanner(
  msgEl: HTMLElement,
  messageId: string,
  verdict: AnalyzeResponse,
  callbacks: BannerCallbacks,
): HTMLElement | null {
  // Replace any existing banner for this message — handles re-analysis
  // cleanly without piling up DOM nodes.
  const existing = msgEl.querySelector<HTMLElement>(`[${BANNER_ATTR}="${CSS.escape(messageId)}"]`);
  if (existing) existing.remove();

  const bodyEl = msgEl.querySelector<HTMLElement>(".a3s");
  if (!bodyEl?.parentElement) return null;

  const host = document.createElement("div");
  host.setAttribute(BANNER_ATTR, messageId);
  // `all: initial` resets any inherited Gmail styling on the host;
  // display + margin re-establish flow positioning.
  host.style.cssText = "all:initial;display:block;margin:8px 0;";

  const root = host.attachShadow({ mode: "open" });
  buildShadow(root, verdict);
  wireButtons(root, callbacks);

  bodyEl.parentElement.insertBefore(host, bodyEl);
  return host;
}

export function removeBanner(host: HTMLElement): void {
  host.remove();
}

// Find any banner node currently injected for this message. Used by the
// dismiss path so we don't have to track host references in caller code.
export function findBanner(msgEl: Element, messageId: string): HTMLElement | null {
  return msgEl.querySelector<HTMLElement>(`[${BANNER_ATTR}="${CSS.escape(messageId)}"]`);
}

// ---------- internals ----------

function buildShadow(root: ShadowRoot, verdict: AnalyzeResponse): void {
  // Static markup with no untrusted interpolation. Headline and subtitle
  // are set via textContent below, which can't trigger HTML parsing even
  // if the model returned something funky in `explanation`.
  root.innerHTML = `
    <style>${BANNER_CSS}</style>
    <div class="banner" role="region" aria-label="WhyShield warning">
      <span class="icon" aria-hidden="true">⚠</span>
      <div class="body">
        <p class="headline"></p>
        <p class="subtitle"></p>
        <div class="actions">
          <button type="button" class="btn btn-primary" data-action="explain">
            Explain why
          </button>
          <button type="button" class="btn btn-secondary" data-action="mark-safe">
            Mark as safe
          </button>
          <button type="button" class="btn btn-tertiary" data-action="dismiss">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  `;
  const headline = root.querySelector<HTMLParagraphElement>(".headline");
  const subtitle = root.querySelector<HTMLParagraphElement>(".subtitle");
  if (headline) headline.textContent = headlineFor(verdict.reasons);
  if (subtitle) subtitle.textContent = truncateExplanation(verdict.explanation);
}

function wireButtons(root: ShadowRoot, callbacks: BannerCallbacks): void {
  root
    .querySelector<HTMLButtonElement>("[data-action='explain']")
    ?.addEventListener("click", callbacks.onExplain);
  root
    .querySelector<HTMLButtonElement>("[data-action='mark-safe']")
    ?.addEventListener("click", callbacks.onMarkSafe);
  root
    .querySelector<HTMLButtonElement>("[data-action='dismiss']")
    ?.addEventListener("click", callbacks.onDismiss);
}

// Pick the most informative human headline from the heuristic reasons.
// Mirrors warning.ts's headlineFor() in tone — soft framings, no banned
// words, second person.
function headlineFor(reasons: Reason[]): string {
  const codes = new Set(reasons.map((r) => r.code as ReasonCode));

  if (codes.has("display-name-spoof")) {
    return "This email might not really be from the company it claims to be";
  }
  if (codes.has("link-typosquat-of-brand")) {
    return "This email contains a link that looks like a phishing trick";
  }
  if (codes.has("link-ip-as-host")) {
    return "This email links to a numeric address instead of a normal site";
  }
  if (codes.has("free-email-brand-impersonation")) {
    return "This email might be impersonating a brand you know";
  }
  if (
    codes.has("urgency-language") ||
    codes.has("credential-request-language") ||
    codes.has("model-flagged")
  ) {
    return "This email shows signs of a phishing message";
  }
  if (codes.has("auth-spf-fail") || codes.has("auth-dkim-fail") || codes.has("auth-dmarc-fail")) {
    return "This email's sender details don't add up";
  }
  return "This email might not be what it claims";
}

// Per session 5 product call (option c): up to two sentences, hard cap
// at 220 chars, end with "…" if truncated, never break mid-word.
const MAX_SUBTITLE_CHARS = 220;

export function truncateExplanation(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  let two = sentences.slice(0, 2).join("").trim();
  if (two.length === 0) two = text.trim();

  if (two.length <= MAX_SUBTITLE_CHARS) return two;

  let cut = two.slice(0, MAX_SUBTITLE_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  // Guard against truncating to a tiny prefix when there's no space
  // anywhere near the end (URL strings, mostly).
  if (lastSpace > MAX_SUBTITLE_CHARS * 0.6) cut = cut.slice(0, lastSpace);
  return `${cut.trimEnd()}…`;
}

// Inline stylesheet. Mirrors the warning interstitial's color palette
// (warning.css) so the banner reads as the same product. Tighter
// padding + smaller type because it lives inside Gmail, not standalone.
const BANNER_CSS = `
  :host {
    all: initial;
    display: block;
    margin: 8px 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  .banner {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 14px 16px;
    color: #e2e8f0;
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  .icon {
    color: #f59e0b;
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
  }
  .body { flex: 1; min-width: 0; }
  .headline {
    font-size: 15px;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0 0 4px;
    line-height: 1.4;
  }
  .subtitle {
    color: #cbd5e1;
    margin: 0 0 12px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 7px 14px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .btn:focus-visible {
    outline: 2px solid #93c5fd;
    outline-offset: 2px;
  }
  .btn-primary {
    background: #2563eb;
    color: #fff;
    border-color: #1d4ed8;
  }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-secondary {
    background: transparent;
    color: #93c5fd;
    border-color: #334155;
  }
  .btn-secondary:hover {
    background: #0f172a;
    border-color: #475569;
  }
  .btn-tertiary {
    background: transparent;
    color: #94a3b8;
    border: none;
    padding: 7px 10px;
  }
  .btn-tertiary:hover { color: #cbd5e1; }
`;
