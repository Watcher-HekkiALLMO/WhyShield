import {
  BYPASS_TTL_MS,
  EMAIL_SAFE_KEY_PREFIX,
  EMAIL_VERDICT_KEY_PREFIX,
  VERDICT_TTL_MS,
} from "../shared/config";
import type {
  AnalyzeEmailRequest,
  AnalyzeResponse,
  BypassEntry,
  CachedEmailVerdict,
  CachedVerdict,
  EmailSafeEntry,
} from "../shared/types";

// SHA-256 hex digest using Web Crypto, matching the backend's KV key shape.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verdict cache: keyed by sha256(host+pathname) so trivial query-string
// variants of the same page share an entry.
async function verdictKey(url: URL): Promise<string> {
  return `verdict:${await sha256Hex(`${url.host}${url.pathname}`)}`;
}

export async function getCachedVerdict(url: URL): Promise<AnalyzeResponse | null> {
  const key = await verdictKey(url);
  const entry = (await chrome.storage.local.get(key))[key] as CachedVerdict | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry.response;
}

export async function putCachedVerdict(url: URL, response: AnalyzeResponse): Promise<void> {
  const key = await verdictKey(url);
  const entry: CachedVerdict = { response, expiresAt: Date.now() + VERDICT_TTL_MS };
  await chrome.storage.local.set({ [key]: entry });
}

// Bypass list: keyed by *exact host*. Subdomains do NOT inherit the bypass
// — clicking Continue Anyway on paypa1.com/login bypasses paypa1.com only.
// login.paypa1.com still gets analyzed independently. This is intentional:
// phishing kits often serve different surfaces under different subdomains
// of the same registrable domain, and a bypass should not extend to
// content the user hasn't actually seen and consented to.
function bypassKey(host: string): string {
  return `bypass:${host}`;
}

export async function isHostBypassed(host: string): Promise<boolean> {
  const key = bypassKey(host);
  const entry = (await chrome.storage.local.get(key))[key] as BypassEntry | undefined;
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    await chrome.storage.local.remove(key);
    return false;
  }
  return true;
}

export async function bypassHost(host: string): Promise<void> {
  const key = bypassKey(host);
  const entry: BypassEntry = { expiresAt: Date.now() + BYPASS_TTL_MS };
  await chrome.storage.local.set({ [key]: entry });
}

// ---------- Email verdict cache ----------
//
// Mirror of the URL verdict cache, keyed by sha256 of the same fields the
// backend KV cache hashes (from + subject + body + sortedLinks). Sorting
// the links is intentional: two emails with identical content but the
// links rearranged are semantically the same email and should share an
// entry; a genuinely different link set (a phisher swapping in a new
// domain) gets a different key.
async function emailVerdictKey(payload: AnalyzeEmailRequest): Promise<string> {
  const sortedLinks = [...payload.links].sort().join("\n");
  const input = [payload.from, payload.subject, payload.body, sortedLinks].join("\n---\n");
  return `${EMAIL_VERDICT_KEY_PREFIX}${await sha256Hex(input)}`;
}

export async function getCachedEmailVerdict(
  payload: AnalyzeEmailRequest,
): Promise<AnalyzeResponse | null> {
  const key = await emailVerdictKey(payload);
  const entry = (await chrome.storage.local.get(key))[key] as CachedEmailVerdict | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry.response;
}

export async function putCachedEmailVerdict(
  payload: AnalyzeEmailRequest,
  response: AnalyzeResponse,
): Promise<void> {
  const key = await emailVerdictKey(payload);
  const entry: CachedEmailVerdict = { response, expiresAt: Date.now() + VERDICT_TTL_MS };
  await chrome.storage.local.set({ [key]: entry });
}

// ---------- Per-message safe list ----------
//
// Keyed by Gmail's data-message-id. NO TTL — when the user clicks "Mark
// as safe," that's an explicit consent for THIS specific message and the
// trust persists across sessions.
//
// Critical: the safe-list does NOT propagate. A bypass on one message
// must not blanket-trust replies, forwards, future emails from the same
// sender, or even other messages in the same thread — phishers exploit
// exactly that kind of inherited trust by sending follow-ups from
// look-alike sender addresses after a victim has whitelisted one
// "harmless" message. Same defensive scoping principle as the URL
// bypass-by-host rule.
function emailSafeKey(messageId: string): string {
  return `${EMAIL_SAFE_KEY_PREFIX}${messageId}`;
}

export async function isMessageMarkedSafe(messageId: string): Promise<boolean> {
  const key = emailSafeKey(messageId);
  const entry = (await chrome.storage.local.get(key))[key] as EmailSafeEntry | undefined;
  return entry !== undefined;
}

export async function markMessageSafe(messageId: string): Promise<void> {
  const key = emailSafeKey(messageId);
  const entry: EmailSafeEntry = { markedAt: Date.now() };
  await chrome.storage.local.set({ [key]: entry });
}
