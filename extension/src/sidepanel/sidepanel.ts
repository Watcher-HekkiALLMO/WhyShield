import {
  BACKEND_URL,
  EXPLAIN_CONTEXT_KEY_PREFIX,
  EXPLAIN_EMAIL_PATH,
  EXPLAIN_URL_PATH,
} from "../shared/config";
import type { ExplainContext } from "../shared/types";

type State = "opening" | "streaming" | "complete" | "error" | "no-data";

let currentContext: ExplainContext | null = null;
let currentAbort: AbortController | null = null;
let accumulatedText = "";

const els = {
  meta: document.getElementById("meta") as HTMLDivElement,
  badge: document.getElementById("badge") as HTMLSpanElement,
  urlDisplay: document.getElementById("url-display") as HTMLSpanElement,
  emailSender: document.getElementById("email-sender") as HTMLSpanElement,
  emailSubject: document.getElementById("email-subject") as HTMLSpanElement,
  skeleton: document.getElementById("skeleton") as HTMLDivElement,
  explanation: document.getElementById("explanation") as HTMLParagraphElement,
  errorActions: document.getElementById("error-actions") as HTMLDivElement,
  retryBtn: document.getElementById("retry-btn") as HTMLButtonElement,
  empty: document.getElementById("empty") as HTMLDivElement,
};

function setState(state: State): void {
  document.body.dataset.state = state;
  els.skeleton.hidden = state !== "opening";
  els.explanation.hidden = state !== "streaming" && state !== "complete" && state !== "error";
  els.errorActions.hidden = state !== "error";
  els.empty.hidden = state !== "no-data";
  els.meta.hidden = state === "no-data" || state === "opening";
}

function renderHeader(ctx: ExplainContext): void {
  els.badge.className = `badge badge-${ctx.verdict}`;
  els.badge.textContent = ctx.verdict;

  if (ctx.type === "url") {
    els.urlDisplay.textContent = ctx.url;
    els.urlDisplay.hidden = false;
    els.emailSender.hidden = true;
    els.emailSubject.hidden = true;
  } else {
    els.urlDisplay.hidden = true;
    els.emailSender.textContent = ctx.from;
    els.emailSender.hidden = false;
    els.emailSubject.textContent = ctx.subject;
    els.emailSubject.hidden = ctx.subject.length === 0;
  }
}

async function getCurrentTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

// Read the per-tab explain context from chrome.storage.session AND delete
// it. Consume-on-read means re-opening the side panel from the toolbar
// (without a fresh "Explain why" click) lands on the no-data state, per
// the spec.
async function consumeContext(): Promise<ExplainContext | null> {
  const tabId = await getCurrentTabId();
  if (tabId === undefined) return null;
  const key = `${EXPLAIN_CONTEXT_KEY_PREFIX}${tabId}`;
  const stored = await chrome.storage.session.get(key);
  const ctx = stored[key] as ExplainContext | undefined;
  if (!ctx) return null;
  await chrome.storage.session.remove(key);
  return ctx;
}

function handleSseEvent(eventStr: string): void {
  // SSE event = several lines, each "field: value". We only consume `data`.
  let data = "";
  for (const line of eventStr.split("\n")) {
    if (line.startsWith("data: ")) data += line.slice(6);
    else if (line.startsWith("data:")) data += line.slice(5);
  }
  if (data === "" || data === "[DONE]") return;
  try {
    const chunk = JSON.parse(data) as string;
    accumulatedText += chunk;
    els.explanation.textContent = accumulatedText;
    // Keep the latest text visible as the stream grows.
    document.scrollingElement?.scrollTo({
      top: document.scrollingElement.scrollHeight,
    });
  } catch {
    // Malformed chunk; skip rather than killing the whole stream.
  }
}

async function readSseStream(body: ReadableStream<Uint8Array>): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n\n");
    while (nl !== -1) {
      const evt = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      handleSseEvent(evt);
      nl = buffer.indexOf("\n\n");
    }
  }
}

async function startStream(ctx: ExplainContext): Promise<void> {
  // Cancel any in-progress request before starting a new one. Necessary
  // when the user clicks "Explain why" again while the panel is still
  // streaming the previous response.
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  currentContext = ctx;
  accumulatedText = "";
  els.explanation.textContent = "";
  renderHeader(ctx);
  setState("streaming");

  // Endpoint depends on the source. The backend's validators ignore
  // extra fields (the `type` discriminator), so we send ctx verbatim.
  const path = ctx.type === "email" ? EXPLAIN_EMAIL_PATH : EXPLAIN_URL_PATH;

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
      signal: currentAbort.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`backend returned ${res.status}`);
    }
    await readSseStream(res.body);
    setState("complete");
  } catch (e) {
    // AbortError = we cancelled intentionally to start a new stream;
    // leave the UI alone, the new stream will set its own state.
    if ((e as Error).name === "AbortError") return;
    setState("error");
  }
}

els.retryBtn.addEventListener("click", () => {
  if (currentContext) void startStream(currentContext);
});

// Multiple "Explain why" clicks while the panel is open: background
// rewrites the storage key, we hear it here, consume it, and re-stream.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "session") return;
  const tabId = await getCurrentTabId();
  if (tabId === undefined) return;
  const key = `${EXPLAIN_CONTEXT_KEY_PREFIX}${tabId}`;
  const change = changes[key];
  if (!change?.newValue) return;
  // Consume so a later toolbar reopen lands on no-data.
  await chrome.storage.session.remove(key);
  void startStream(change.newValue as ExplainContext);
});

// Initial mount.
(async () => {
  setState("opening");
  const ctx = await consumeContext();
  if (ctx) void startStream(ctx);
  else setState("no-data");
})();
