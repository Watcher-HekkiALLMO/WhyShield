# WhyShield extension

The Chrome extension. Manifest V3, TypeScript, Vite + `@crxjs/vite-plugin`.

## Quickstart

You need:

- Node 20+, pnpm 9+
- Chrome 120+ (for Manifest V3, side panel, `chrome.sidePanel.open`)
- The backend running locally (see [/backend/README.md](../backend/README.md) — short version: `cd backend && pnpm dev`)

From the repo root:

```bash
pnpm install
pnpm -r build
```

`pnpm -r build` runs `tsc --noEmit` for the backend and `vite build` for the extension. The extension lands in `extension/dist/`.

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Select `extension/dist/`.
5. Pin WhyShield to the toolbar via the puzzle-piece menu (optional, but helps you see when the extension is active).

## Dev workflow

In one terminal:

```bash
cd backend
pnpm dev
```

In another:

```bash
cd extension
pnpm dev
```

Vite watches and rebuilds. After a change, click the reload icon next to the WhyShield card on `chrome://extensions` so the service worker picks up the new bundle. Content of the warning page hot-reloads automatically.

## Testing the URL warning end-to-end

With both terminals running and the extension loaded:

1. New tab, navigate to a known typosquat: `http://paypa1.com/login`.
2. Background worker calls `POST /analyze/url`. Backend returns `{ verdict: "malicious", reasons: [{ code: "typosquat-of-brand", detail: "paypal.com" }], ... }`.
3. Tab gets redirected to the warning interstitial.
4. Three buttons:
   - **Explain why** — opens the side panel with a placeholder. (Streaming explanation lands in a future session.)
   - **Go back** — `history.back()` if there's history; otherwise asks the worker to close the tab via `chrome.tabs.remove`.
   - **Continue anyway** — registers a 1-hour bypass for the exact host (`paypa1.com`), then redirects to the original URL.

### Verifying the bypass scope

Click Continue Anyway → you land on `paypa1.com`. Reload → no warning (bypass active). Now navigate to `login.paypa1.com` — the warning still appears, because **bypasses are by exact host and subdomains do NOT inherit**. This is intentional; phishing kits often serve different surfaces under different subdomains.

To clear a bypass manually: `chrome://extensions` → WhyShield → **Service worker** → **Application** tab → **Storage** → **Extension Storage** → **Local** → delete the `bypass:paypa1.com` row. Or just wait an hour.

To clear all caches: same path, click **Clear all**.

## Pointing at a non-local backend

`BACKEND_URL` is hardcoded in `src/shared/config.ts` to `http://localhost:8787`. When we deploy to Cloudflare, this becomes a `chrome.storage.local`-backed setting with a default. For now: edit the constant and rebuild.

## What's not done yet

- "Explain why" side-panel streaming with Claude (next session)
- Gmail content script / email warnings
- Settings page (whitelist, sensitivity slider, dev/prod backend switcher)
- Real Watcher mascot art (currently a placeholder shield SVG)
- Chrome Web Store listing
- Production backend deployment
