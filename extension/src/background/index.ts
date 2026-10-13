import {
  EXPLAIN_CONTEXT_KEY_PREFIX,
  SUSPICIOUS_INTERSTITIAL_THRESHOLD,
  WARNING_PAGE_PATH,
} from "../shared/config";
import type {
  AnalyzeEmailRequest,
  AnalyzeResponse,
  ExplainContext,
} from "../shared/types";
import { analyzeEmail, analyzeUrl } from "./api";
import {
  bypassHost,
  getCachedEmailVerdict,
  getCachedVerdict,
  isHostBypassed,
  isMessageMarkedSafe,
  markMessageSafe,
  putCachedEmailVerdict,
  putCachedVerdict,
} from "./storage";

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
    if (msg?.type === "analyze-email" && msg.payload) {
      const verdict = await handleAnalyzeEmail(
        msg.messageId as string | undefined,
        msg.payload as AnalyzeEmailRequest,
      );
      sendResponse(verdict);
      return;
    }
    if (msg?.type === "explain-email-context" && msg.context && sender.tab?.id !== undefined) {
      // Mirror of the URL "explain-context" handler, plus a sidePanel.open
      // call. The Gmail content script can't open the side panel itself
      // (chrome.sidePanel isn't exposed to content scripts), so we
      // delegate. The user-gesture from the banner button click is
      // preserved across the runtime.sendMessage boundary, which is what
      // chrome.sidePanel.open requires.
      //
      // CONTRACT: stash context in storage BEFORE opening the panel, so
      // when the panel mounts and reads its tab's entry, it's there.
      const tabId = sender.tab.id;
      const key = `${EXPLAIN_CONTEXT_KEY_PREFIX}${tabId}`;
      await chrome.storage.session.set({ [key]: msg.context as ExplainContext });
      await chrome.sidePanel.open({ tabId });
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "mark-email-safe" && typeof msg.messageId === "string") {
      // CONTRACT: respond AFTER chrome.storage.local.set resolves so the
      // content script's banner removal can rely on the safe-list being
      // durable before the next mutation tick re-injects.
      await markMessageSafe(msg.messageId);
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true; // keep the response channel open for the async work above
});

// Email analysis flow. Mirrors the URL flow in onBeforeNavigate but
// runs on demand from the Gmail content script (no navigation event to
// hook). Bundles the safe-list pre-check so the content script doesn't
// need a separate round-trip.
async function handleAnalyzeEmail(
  messageId: string | undefined,
  payload: AnalyzeEmailRequest,
): Promise<{ skipped: true } | { verdict: AnalyzeResponse } | { verdict: null }> {
  if (messageId && (await isMessageMarkedSafe(messageId))) {
    return { skipped: true };
  }

  const cached = await getCachedEmailVerdict(payload);
  if (cached) return { verdict: cached };

  const verdict = await analyzeEmail(payload);
  if (!verdict) return { verdict: null }; // backend unreachable: fail open
  await putCachedEmailVerdict(payload, verdict);
  return { verdict };
}
