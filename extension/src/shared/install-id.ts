import { INSTALL_ID_KEY } from "./config";

// A random UUID minted once per installation and sent on every backend
// request so the server can rate-limit per install. It is not derived
// from, or linked to, the user's Google account, email, or anything
// else; reinstalling the extension produces a new one. Never logged.

// Memoized per JS context so concurrent first-run callers share one
// mint instead of racing to write two different ids.
let pending: Promise<string> | null = null;

export function getInstallId(): Promise<string> {
  if (!pending) {
    pending = loadOrCreate().catch((e) => {
      pending = null; // let the next caller retry rather than caching a failure
      throw e;
    });
  }
  return pending;
}

async function loadOrCreate(): Promise<string> {
  const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
  const existing = stored[INSTALL_ID_KEY];
  if (typeof existing === "string" && existing !== "") return existing;

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [INSTALL_ID_KEY]: id });
  return id;
}
