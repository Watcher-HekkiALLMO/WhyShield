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
  // Static markup with no interpolation at all. The verdict class (band
  // color), headline, and subtitle are applied afterwards via classList
  // and textContent, which can't trigger HTML parsing. The verdict is a
  // bare cast of backend JSON and the backend URL is user-configurable,
  // so nothing from it may be concatenated into this string.
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
  root.querySelector(".banner")?.classList.add(`banner-${verdict.verdict}`);
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

// Inline stylesheet. The Watcher palette, inlined because a Shadow DOM
// inside Gmail can't reach src/shared/theme.css; keep the hex values in
// sync with it. Deliberately restrained versus the warning page: no
// mascot, no watermark, 2px border instead of 3px, no offset shadow. It
// lives inside Gmail's UI and should read as a note, not a poster. System
// fonts, since bundled fonts would need a web-accessible font file.
const BANNER_CSS = `
  :host {
    all: initial;
    display: block;
    margin: 8px 0;
    --w-ink: #120a1f;
    --w-surface: #1f1235;
    --w-surface-2: #2a1a47;
    --w-line: #4a2c7a;
    --w-line-soft: #332052;
    --w-text: #f3eefa;
    --w-text-body: #e3d9f0;
    --w-muted: #b9a8d4;
    --w-crystal: #8b5cf6;
    --w-crystal-hi: #c4a7f7;
    --w-crystal-deep: #7c4de6;
    --w-crimson: #d11a2a;
    --w-crimson-text: #f04452;
    --w-gold: #f2b705;
  }
  .banner {
    /* On .banner, not :host: the host's inline all:initial outranks a
     * :host rule, which is why the old banner fell back to a serif. */
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: var(--w-surface);
    border: 2px solid var(--w-line);
    /* The verdict band, as a thicker top edge. */
    border-top: 6px solid var(--w-line);
    padding: 14px 16px;
    color: var(--w-text);
    font-size: 14px;
    line-height: 1.5;
  }
  .banner-malicious { border-top-color: var(--w-crimson); }
  .banner-suspicious { border-top-color: var(--w-gold); }
  .icon {
    color: var(--w-gold);
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
  }
  .banner-malicious .icon { color: var(--w-crimson-text); }
  .body { flex: 1; min-width: 0; }
  .headline {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 4px;
    line-height: 1.4;
  }
  .subtitle {
    color: var(--w-text-body);
    margin: 0 0 12px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    appearance: none;
    border: 2px solid transparent;
    border-radius: 0;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    padding: 6px 14px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .btn:focus-visible {
    outline: 2px solid var(--w-crystal-hi);
    outline-offset: 2px;
  }
  .btn-primary {
    background: var(--w-crystal-deep);
    color: #fff;
    border-color: var(--w-crystal-hi);
  }
  .btn-primary:hover { background: #6d3bd9; }
  .btn-secondary {
    background: transparent;
    color: var(--w-crystal-hi);
    border-color: var(--w-crystal);
  }
  .btn-secondary:hover {
    background: var(--w-surface-2);
    border-color: var(--w-crystal-hi);
  }
  .btn-tertiary {
    background: transparent;
    color: var(--w-muted);
    border: none;
    font-weight: 500;
    padding: 6px 10px;
    text-decoration: underline;
    text-decoration-color: var(--w-line);
    text-underline-offset: 3px;
  }
  .btn-tertiary:hover { color: var(--w-text); }
`;
