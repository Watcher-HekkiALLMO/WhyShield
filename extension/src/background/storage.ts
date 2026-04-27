import { BYPASS_TTL_MS, VERDICT_TTL_MS } from "../shared/config";
import type { AnalyzeResponse, BypassEntry, CachedVerdict } from "../shared/types";

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
