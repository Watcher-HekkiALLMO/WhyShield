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

async function onExplainWhy(): Promise<void> {
  // Side-panel streaming lands in a future session — for now the panel
  // shows a placeholder. Opening it requires a window id and a user
  // gesture (this button click counts).
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
  // Tag the body with the verdict so future styling can differentiate
  // "malicious" vs "suspicious" without TS changes.
  document.body.dataset.verdict = params.verdict;

  document.getElementById("headline")!.textContent = headlineFor(params.reasons);
  document.getElementById("explanation")!.textContent = params.explanation;
  document.getElementById("source-url")!.textContent = params.url;

  document.getElementById("explain-btn")!.addEventListener("click", () => {
    void onExplainWhy();
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
