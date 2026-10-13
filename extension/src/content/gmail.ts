// Gmail content script — bootstrap, mount detection, debounced
// orchestration of email analysis and banner injection.
//
// Lifecycle:
//   1. document_idle → bootstrap() runs.
//   2. waitForMain() blocks on a MutationObserver until [role="main"]
//      mounts (Gmail's SPA shell loads asynchronously, sometimes seconds
//      after document_idle).
//   3. We attach a single MutationObserver to [role="main"] and on every
//      mutation schedule a debounced processCurrentMessage().
//   4. processCurrentMessage finds the latest visible expanded message,
//      extracts its fields, asks the background worker for a verdict,
//      and injects a banner if the verdict warrants one.
//
// Per-tab state we keep in memory (not persisted):
//   - dismissed: set of message IDs the user has Dismissed in this view.
//     Cleared on hashchange so the spec's "navigating away and back
//     reappears the banner" rule holds.
//
// Folder skip rule: per session 5 spec, Sent / Drafts / Scheduled / Chats
// are out of scope. Inbox, All Mail, search results, labels, spam, trash
// are all analyzed.

import { getSettings } from "../shared/settings";
import type { AnalyzeEmailRequest, AnalyzeResponse, ExplainEmailContext } from "../shared/types";
import { findBanner, injectBanner, removeBanner } from "./banner";
import {
  extractBody,
  extractLinks,
  extractMessageId,
  extractSender,
  extractSubject,
} from "./extractors";

const DEBOUNCE_MS = 250;
const SKIPPED_FOLDERS = new Set(["sent", "drafts", "scheduled", "chats"]);

// In-memory dismissed set, scoped to this content-script lifetime within
// this tab. Cleared on hash change (Gmail SPA navigation).
const dismissed = new Set<string>();

// Re-entry guard. processCurrentMessage awaits the backend; we don't
// want a second observer-fired tick stomping on it mid-flight.
let processing = false;

function inSkippedFolder(): boolean {
  // Hash like "#inbox/<threadId>" or "#search/<query>/<threadId>" — the
  // first segment after `#` is the folder.
  const m = location.hash.match(/^#([^/?]+)/);
  return SKIPPED_FOLDERS.has(m?.[1] ?? "");
}

// Same rule as the URL interstitial: malicious always, suspicious only at
// or above the user's sensitivity threshold.
function shouldShowBanner(verdict: AnalyzeResponse, threshold: number): boolean {
  if (verdict.verdict === "malicious") return true;
  if (verdict.verdict === "suspicious" && verdict.confidence >= threshold) return true;
  return false;
}

// Latest visible expanded message in the current conversation. "Latest"
// = last in DOM order (Gmail orders messages oldest→newest top→bottom).
// "Expanded" = .a3s body has rendered height (collapsed message stubs
// have offsetHeight === 0). If the user expands an older message, that
// becomes the latest expanded one and we re-analyze.
function findLatestExpandedMessage(): HTMLElement | null {
  const messages = document.querySelectorAll<HTMLElement>("[role='main'] [data-message-id]");
  let latest: HTMLElement | null = null;
  for (const msg of messages) {
    const body = msg.querySelector<HTMLElement>(".a3s");
    if (body && body.offsetHeight > 0) latest = msg;
  }
  return latest;
}

async function processCurrentMessage(): Promise<void> {
  if (processing) return;
  if (inSkippedFolder()) return;

  processing = true;
  try {
    // Read per tick, not once at bootstrap, so a sensitivity change or
    // switching email warnings off applies to the next message opened
    // without reloading Gmail.
    const settings = await getSettings();
    if (!settings.emailWarnings) return;

    const msgEl = findLatestExpandedMessage();
    if (!msgEl) return;

    const messageId = extractMessageId(msgEl);
    if (!messageId) return;
    if (dismissed.has(messageId)) return;

    // De-dupe: if a banner already exists for this message, the work
    // below would just rebuild it identically. Skip.
    if (findBanner(msgEl, messageId)) return;

    const from = extractSender(msgEl);
    if (!from) return; // can't analyze without a sender
    const subject = extractSubject();
    const body = extractBody(msgEl);
    const links = extractLinks(msgEl);

    const payload: AnalyzeEmailRequest = { from, subject, body, links };

    const result = (await chrome.runtime.sendMessage({
      type: "analyze-email",
      messageId,
      payload,
    })) as { skipped: true } | { verdict: AnalyzeResponse } | { verdict: null };

    if ("skipped" in result) return; // safe-listed
    if (!result.verdict) return; // backend unreachable: fail open
    if (!shouldShowBanner(result.verdict, settings.sensitivity)) return;

    // Gmail may have re-rendered while we awaited — make sure our
    // message div is still in the DOM before injecting.
    if (!msgEl.isConnected) return;

    injectBanner(msgEl, messageId, result.verdict, {
      onExplain: () => {
        void onExplainClick(payload, result.verdict);
      },
      onMarkSafe: () => {
        void onMarkSafeClick(messageId, msgEl);
      },
      onDismiss: () => {
        onDismissClick(messageId, msgEl);
      },
    });
  } finally {
    processing = false;
  }
}

let scheduleTimer: number | null = null;

function scheduleProcess(): void {
  if (scheduleTimer !== null) clearTimeout(scheduleTimer);
  scheduleTimer = window.setTimeout(() => {
    scheduleTimer = null;
    void processCurrentMessage();
  }, DEBOUNCE_MS);
}

// Block until [role="main"] mounts. Gmail's shell loads asynchronously
// after document_idle, sometimes by several seconds on a cold tab.
function waitForMain(): Promise<HTMLElement> {
  const existing = document.querySelector<HTMLElement>("[role='main']");
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const main = document.querySelector<HTMLElement>("[role='main']");
      if (main) {
        observer.disconnect();
        resolve(main);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Explain why → ship the context to the background worker, which stashes
// it in chrome.storage.session AND opens the side panel for this tab.
// Both happen on the background side because (a) chrome.sidePanel isn't
// exposed to content scripts, and (b) the user gesture from this click
// is preserved across the runtime.sendMessage boundary, which is what
// chrome.sidePanel.open requires.
async function onExplainClick(
  payload: AnalyzeEmailRequest,
  verdict: AnalyzeResponse,
): Promise<void> {
  const context: ExplainEmailContext = {
    type: "email",
    from: payload.from,
    replyTo: payload.replyTo,
    subject: payload.subject,
    body: payload.body,
    links: payload.links,
    headerHints: payload.headerHints,
    verdict: verdict.verdict,
    confidence: verdict.confidence,
    reasons: verdict.reasons,
  };
  await chrome.runtime.sendMessage({ type: "explain-email-context", context });
}

// Mark as safe → persist the message ID, then remove the banner. The
// background handler awaits chrome.storage.local.set before responding,
// so by the time we remove the banner the safe-list is durable. The
// MutationObserver will fire on the removal, processCurrentMessage will
// re-run, and the backend's pre-check will return { skipped: true } —
// no re-injection.
async function onMarkSafeClick(messageId: string, msgEl: HTMLElement): Promise<void> {
  await chrome.runtime.sendMessage({ type: "mark-email-safe", messageId });
  const host = findBanner(msgEl, messageId);
  if (host) removeBanner(host);
}

// Dismiss → in-memory only. Reappears on hashchange (clears the set) or
// full page reload (fresh content script).
function onDismissClick(messageId: string, msgEl: HTMLElement): void {
  dismissed.add(messageId);
  const host = findBanner(msgEl, messageId);
  if (host) removeBanner(host);
}

// Guard so the observer is attached at most once per content-script
// lifetime, even if the user toggles email warnings off and on.
let observing = false;

async function startObserving(): Promise<void> {
  if (observing) return;
  observing = true;

  const main = await waitForMain();

  // One observer for the lifetime of the content script. childList +
  // subtree because Gmail mutates deep into the message tree on every
  // expand / collapse / scroll-load.
  const observer = new MutationObserver(scheduleProcess);
  observer.observe(main, { childList: true, subtree: true });

  // SPA navigation: clear in-view state and re-analyze the new view.
  // Per spec, Dismiss reappears on "navigating away and back."
  window.addEventListener("hashchange", () => {
    dismissed.clear();
    scheduleProcess();
  });

  // Initial pass for the message that may already be open.
  scheduleProcess();
}

async function bootstrap(): Promise<void> {
  // Email warnings off → don't attach the observer at all, so a disabled
  // WhyShield costs Gmail nothing. If the user turns the setting on while
  // this tab is open, the storage listener below starts the observer
  // without needing a reload. Turning it off mid-session is handled per
  // tick inside processCurrentMessage.
  const settings = await getSettings();
  if (settings.emailWarnings) void startObserving();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.emailWarnings?.newValue === true) void startObserving();
  });
}

void bootstrap();
