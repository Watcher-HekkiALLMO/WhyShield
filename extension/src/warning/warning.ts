import type { Reason, Verdict } from "../shared/types";

interface WarningParams {
  url: string;
  verdict: Verdict;
  confidence: number;
  explanation: string;
  reasons: Reason[];
}

function parseParams(): WarningParams | null {
  const p = new URLSearchParams(window.location.search);
  const url = p.get("url");
  const verdict = p.get("verdict");
  const confidenceStr = p.get("confidence");
  const explanation = p.get("explanation");
  const reasonsStr = p.get("reasons");
  if (!url || !verdict || !confidenceStr || !explanation || !reasonsStr) return null;
  let reasons: Reason[];
  try {
    reasons = JSON.parse(reasonsStr) as Reason[];
  } catch {
    return null;
  }
  return {
    url,
    verdict: verdict as Verdict,
    confidence: Number(confidenceStr),
    explanation,
    reasons,
  };
}

// Pick the most informative human headline from the heuristic reasons.
// Reasons are emitted in priority order by the backend, so reasons[0]
// is the strongest signal we have for this verdict.
function headlineFor(reasons: Reason[]): string {
  const r = reasons[0];
  if (!r) return "This site might not be what it claims";
  switch (r.code) {
    case "typosquat-of-brand":
      return r.detail
        ? `This site might not be the real ${r.detail}`
        : "This site might be impersonating a brand you know";
    case "ip-as-host":
      return "This link points to an IP address instead of a domain name";
    case "punycode-host":
      return "This site uses unusual characters in its address";
    case "suspicious-tld":
      return "This site uses a top-level domain often used by phishers";
    case "model-flagged":
      return "This site shows signs of a phishing page";
    default:
      return "This site might not be what it claims";
  }
}

// Edit distance, used only to find which host label the typosquat
// heuristic matched. Hosts are a handful of short labels, so the naive
// O(n*m) table is fine.
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(tmp + 1, (prev[j - 1] ?? 0) + 1, diag + cost);
      diag = tmp;
    }
  }
  return prev[b.length] ?? 0;
}

// Render the address. When the top reason is typosquat-of-brand, the
// host label closest to the brand's first label (paypa1 vs paypal) gets
// a wavy crimson underline so the eye lands on the swapped character.
// Built from text nodes and spans only: the URL is attacker-controlled
// and must never go through innerHTML.
function renderSourceUrl(el: HTMLElement, url: string, reasons: Reason[]): void {
  el.textContent = "";
  const top = reasons[0];
  // `reasons` comes from the query string with no shape check and this
  // page is web-accessible, so detail must be verified as a string before
  // it's used; a bad shape falls back to the plain URL, not a crash.
  const brandLabel =
    top?.code === "typosquat-of-brand" && typeof top.detail === "string"
      ? top.detail.split(".")[0]
      : undefined;

  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (!brandLabel || !parsed || !url.includes(parsed.hostname)) {
    el.textContent = url;
    return;
  }

  const labels = parsed.hostname.split(".");
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  labels.forEach((label, i) => {
    const d = editDistance(label.toLowerCase(), brandLabel.toLowerCase());
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  // Only underline a near miss. A label that merely shares a letter or
  // two with the brand would be a confusing thing to point at.
  if (best === -1 || bestDistance > 2) {
    el.textContent = url;
    return;
  }

  const hostStart = url.indexOf(parsed.hostname);
  const labelOffset = labels.slice(0, best).reduce((n, l) => n + l.length + 1, 0);
  const start = hostStart + labelOffset;
  const end = start + (labels[best]?.length ?? 0);

  el.append(url.slice(0, start));
  const bad = document.createElement("span");
  bad.className = "bad";
  bad.textContent = url.slice(start, end);
  el.append(bad, url.slice(end));
}

async function onExplainWhy(params: WarningParams): Promise<void> {
  // The side panel reads its context from chrome.storage.session on
  // mount (and on storage.onChanged, for repeat clicks). The background
  // worker writes the entry under the current tab's id when it receives
  // this message.
  //
  // CONTRACT: await sendMessage before opening the panel. If we open
  // first, the panel mounts before storage.session is populated and
  // renders the no-data state. The worker holds up its side by awaiting
  // the storage write before calling sendResponse.
  await chrome.runtime.sendMessage({
    type: "explain-context",
    context: {
      // `type` discriminator is required after the side panel started
      // branching on context kind for the email flow. Missing it would
      // crash the URL flow once sidepanel.ts treats ctx as a union.
      type: "url",
      url: params.url,
      verdict: params.verdict,
      confidence: params.confidence,
      reasons: params.reasons,
    },
  });

  const win = await chrome.windows.getCurrent();
  if (win.id !== undefined) {
    await chrome.sidePanel.open({ windowId: win.id });
  }
}

async function onGoBack(): Promise<void> {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  // No history (user typed the URL directly, or it was opened in a fresh
  // tab — both common for phishing email links). The warning page can't
  // call chrome.tabs.remove itself, so the worker does it.
  await chrome.runtime.sendMessage({ type: "close-tab" });
}

async function onContinue(params: WarningParams): Promise<void> {
  const host = new URL(params.url).host;

  // Bypass scope: by exact host. Subdomains do NOT inherit. If the user
  // continues to paypa1.com/login, login.paypa1.com is still analyzed
  // independently on the next navigation. See storage.ts bypassKey() for
  // the security rationale.
  //
  // CRITICAL: await sendMessage before redirect. If we redirect first,
  // the new navigation triggers onBeforeNavigate before chrome.storage.local
  // has persisted the bypass entry, and the user gets re-warned in a loop.
  // The worker holds up its side of the contract by awaiting the storage
  // write before calling sendResponse.
  await chrome.runtime.sendMessage({ type: "bypass-host", host });

  window.location.replace(params.url);
}

function render(params: WarningParams): void {
  // The stylesheet keys the band color and the malicious-only motifs
  // (X watermark, crack) off this attribute. No other TS involvement.
  document.body.dataset.verdict = params.verdict;

  document.getElementById("headline")!.textContent = headlineFor(params.reasons);
  document.getElementById("explanation")!.textContent = params.explanation;
  renderSourceUrl(document.getElementById("source-url")!, params.url, params.reasons);

  document.getElementById("explain-btn")!.addEventListener("click", () => {
    void onExplainWhy(params);
  });
  document.getElementById("back-btn")!.addEventListener("click", () => {
    void onGoBack();
  });
  document.getElementById("continue-btn")!.addEventListener("click", () => {
    void onContinue(params);
  });
}

const params = parseParams();
if (params) {
  render(params);
} else {
  document.getElementById("headline")!.textContent = "Something went wrong";
  document.getElementById("explanation")!.textContent =
    "We couldn't read the warning details for this page. You can close this tab and try again.";
}
