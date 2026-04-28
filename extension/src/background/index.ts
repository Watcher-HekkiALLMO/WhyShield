import {
  EXPLAIN_CONTEXT_KEY_PREFIX,
  SUSPICIOUS_INTERSTITIAL_THRESHOLD,
  WARNING_PAGE_PATH,
} from "../shared/config";
import type { AnalyzeResponse, ExplainContext } from "../shared/types";
import { analyzeUrl } from "./api";
import { bypassHost, getCachedVerdict, isHostBypassed, putCachedVerdict } from "./storage";

// Schemes we never analyze. chrome:// and chrome-extension:// belong to
// Chrome itself; about: and file: aren't realistic phishing vectors and
// would just create noise + break local development.
const SKIPPED_SCHEMES = ["chrome://", "chrome-extension://", "about:", "file://"];

function shouldSkip(rawUrl: string): boolean {
  return SKIPPED_SCHEMES.some((s) => rawUrl.startsWith(s));
}

function shouldInterstitial(v: AnalyzeResponse): boolean {
  if (v.verdict === "malicious") return true;
  if (v.verdict === "suspicious" && v.confidence >= SUSPICIOUS_INTERSTITIAL_THRESHOLD) return true;
  return false;
}

// Build the URL the tab gets redirected to when we want to show the
// warning. The interstitial reads back the verdict from the query string.
function buildWarningUrl(originalUrl: string, verdict: AnalyzeResponse): string {
  const params = new URLSearchParams({
    url: originalUrl,
    verdict: verdict.verdict,
    confidence: String(verdict.confidence),
    explanation: verdict.explanation,
    reasons: JSON.stringify(verdict.reasons),
  });
  return `${chrome.runtime.getURL(WARNING_PAGE_PATH)}?${params.toString()}`;
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // frameId 0 = top-level frame. Subframes (iframes) navigate constantly
  // and aren't the right surface for phishing UX.
  if (details.frameId !== 0) return;
  if (shouldSkip(details.url)) return;

  let parsed: URL;
  try {
    parsed = new URL(details.url);
  } catch {
    return;
  }

  if (await isHostBypassed(parsed.host)) return;

  let verdict = await getCachedVerdict(parsed);
  if (!verdict) {
    verdict = await analyzeUrl(details.url);
    if (!verdict) return; // backend unreachable: fail open
    await putCachedVerdict(parsed, verdict);
  }

  if (!shouldInterstitial(verdict)) return;

  await chrome.tabs.update(details.tabId, { url: buildWarningUrl(details.url, verdict) });
});

// Message channel for the warning page to ask the background worker for
// privileged actions: registering a 1h bypass before continuing, or
// closing the tab when "Go back" is pressed and there's no history.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  void (async () => {
    if (msg?.type === "bypass-host" && typeof msg.host === "string") {
      // CONTRACT: respond AFTER chrome.storage.local.set resolves. The
      // warning page awaits this ack before redirecting the tab to the
      // original URL; if we acked synchronously, the redirect would race
      // the storage write and trigger an immediate re-warning loop.
      // bypassHost() awaits chrome.storage.local.set internally, so the
      // await chain holds.
      await bypassHost(msg.host);
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "close-tab" && sender.tab?.id !== undefined) {
      await chrome.tabs.remove(sender.tab.id);
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "explain-context" && msg.context && sender.tab?.id !== undefined) {
      // CONTRACT: respond AFTER chrome.storage.session.set resolves.
      // The warning page awaits this ack before calling
      // chrome.sidePanel.open; if we acked early, the panel could mount
      // before the entry exists and render no-data.
      const key = `${EXPLAIN_CONTEXT_KEY_PREFIX}${sender.tab.id}`;
      await chrome.storage.session.set({ [key]: msg.context as ExplainContext });
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true; // keep the response channel open for the async work above
});
