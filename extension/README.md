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
   - **Explain why** — opens the side panel and streams a Sonnet-generated educational explanation.
   - **Go back** — `history.back()` if there's history; otherwise asks the worker to close the tab via `chrome.tabs.remove`.
   - **Continue anyway** — registers a 1-hour bypass for the exact host (`paypa1.com`), then redirects to the original URL.

### Verifying the bypass scope

Click Continue Anyway → you land on `paypa1.com`. Reload → no warning (bypass active). Now navigate to `login.paypa1.com` — the warning still appears, because **bypasses are by exact host and subdomains do NOT inherit**. This is intentional; phishing kits often serve different surfaces under different subdomains.

To clear a bypass manually: `chrome://extensions` → WhyShield → **Service worker** → **Application** tab → **Storage** → **Extension Storage** → **Local** → delete the `bypass:paypa1.com` row. Or just wait an hour.

To clear all caches: same path, click **Clear all**.

## Testing the email warning end-to-end

With both terminals running, the extension loaded, and you signed into Gmail at `mail.google.com`:

### Recipe: send yourself a fake-phishing email

The cleanest test surface is an email you compose to your own address with content the heuristics will flag — banks-don't-send-from-gmail + a typosquat link is a guaranteed conclusive verdict. Steps:

1. In Gmail, click **Compose**.
2. **To:** your own Gmail address.
3. **Subject:** `Action required: verify your account`
4. **Body:**

   ```
   Final notice: please verify your password to keep your access active.

   Continue: https://paypa1.com/login
   ```

5. Click **Send**. Gmail delivers it to your own inbox within seconds.
6. Open the new email from your Inbox.
7. Within ~1–2 seconds, the WhyShield banner appears above the message body.

The link in step 4 is a typosquat of `paypal.com` — the backend bubbles it up as a conclusive `link-typosquat-of-brand` verdict, the banner headline reads "This email contains a link that looks like a phishing trick," and the subtitle is a one-or-two-sentence excerpt of the explanation.

### Three buttons, three behaviors

- **Explain why** → opens the side panel; the panel streams a Sonnet-generated 2–3 paragraph educational explanation of *the email*, header showing the sender (monospace) on top and subject below.
- **Mark as safe** → banner disappears immediately. Reload the email — no banner. Reload Gmail — still no banner. The bypass is **per-message-id only**: forward the same email or open a different message from the same sender, and the new copy gets analyzed independently. To clear: `chrome://extensions` → WhyShield → **Service worker** → **Application** → **Storage** → **Extension Storage** → **Local** → delete the `email-safe:<messageId>` row.
- **Dismiss** → banner disappears for this view only. Click into another conversation and back, or reload, and the banner reappears.

### What gets skipped

- Folders: `#sent`, `#drafts`, `#scheduled`, `#chats` — the URL hash check skips these without analyzing.
- Collapsed messages in a thread — only the latest visible expanded message is analyzed. If you expand an older message in the thread, that becomes the analysis target.
- Backend offline → no banner (fail open). Watch the Gmail tab's DevTools console for the network error.

### Regression check: URL flow still works

After loading the updated extension: navigate to `http://paypa1.com/login`. The URL warning interstitial should still appear with all three buttons working as before — the discriminated `ExplainContext` union doesn't break the existing path because warning.ts now passes `type: "url"` in its context payload.

## Settings page

Open it by right-clicking the WhyShield toolbar icon → **Options**, or via `chrome://extensions` → WhyShield → **Details** → **Extension options**. It opens in a full tab.

| Setting | Default | Stored in | Notes |
| --- | --- | --- | --- |
| Warn about look-alike websites | on | sync | Off = the background worker ignores navigations entirely. |
| Warn about suspicious emails in Gmail | on | sync | Off = the Gmail observer is never attached. Turning it on with Gmail open starts it without a reload. |
| Sensitivity | 0.70 | sync | Threshold for "suspicious" verdicts. 0.5 = more warnings, 0.9 = fewer. "Malicious" always warns. |
| Trusted sites | empty | sync | One host per line, exact match, no subdomain inheritance. Skips analysis entirely. URL-only: emails are always checked because senders can be faked. |
| Backend address | production build: `https://whyshield-backend.knower.workers.dev`; dev build: `http://localhost:8787` | sync | Chosen by Vite mode at build time (`pnpm build` vs `pnpm dev`). Must be `https://`, or `http://` to localhost only, or the save is refused. |
| Your own Anthropic API key | empty | **local only** | Sent as `X-WhyShield-API-Key` on every backend request; the backend uses it for that request's Claude calls. Never synced, never logged. |

Changes apply on the next navigation or next email opened; no extension reload needed. **Save** is all-or-nothing: a bad backend URL or an unreadable trusted-host line shows an inline message and nothing is written. **Reset to defaults** also clears the API key.

Every runtime consumer reads these through `getSettings()` in `src/shared/settings.ts`. The constants in `src/shared/config.ts` are only the defaults.

### Testing the settings

1. Add `paypa1.com` under Trusted sites, save, navigate to `http://paypa1.com/login`. No warning, and no `/analyze/url` request in the backend log.
2. Remove it, drag Sensitivity to 0.9, save. Borderline "suspicious" verdicts stop warning; the `paypa1.com` typosquat (a "malicious" verdict) still warns.
3. Turn off "Warn me about suspicious emails in Gmail", reload Gmail, open the test phishing email from the recipe above. No banner. Turn it back on without reloading Gmail, click into another email and back. Banner returns.
4. Paste a deliberately wrong key (e.g. `sk-ant-test`) into the API key field and save. Trigger a warning and click **Explain why**. The backend answers `401 { "error": "byok-rejected" }` instead of streaming, so the side panel lands on its error state with **Try again**. Switch back to the settings tab: an amber notice under the key field reads "This key was rejected by Anthropic. Check it and save again." Clear the field and save. The notice disappears and the stream comes back on the shared key. A rejected key is never silently swapped for the shared one.
5. Type `http://192.168.1.10:8787` as the backend address and save. The save is refused with "Use https:// for remote backends. http:// is only allowed for localhost." `http://localhost:8787` and `http://127.0.0.1:8787` still save.

## Visual identity and mascot

Palette, fonts, and reusable treatments live in `src/shared/theme.css`; the design source is `design/design-direction.html` at the repo root. Mascot masters are in `design/mascot/`; the sizes the extension ships are rendered into `public/mascot/` by `pnpm render-mascot` (sharp). Fonts are bundled in `public/fonts/`, never fetched. See the Visual identity section of the root `CLAUDE.md` for the motif rules and the contrast table.

## "Explain why" streaming

Click **Explain why** on the warning interstitial → side panel opens → a Sonnet-generated 2–3 paragraph educational explanation streams in, character by character, in plain English. Multiple clicks generate fresh explanations (no caching for explanations in v1; verdicts are still cached for 24h on the backend). If the network drops mid-stream, the side panel keeps what it got plus a **Try again** button.

Reopening the side panel from the toolbar (without a fresh "Explain why" click) lands on a no-data state — context-passing through `chrome.storage.session` is consume-on-read, so toolbar opens don't re-show stale explanations.

## What's not done yet

- Viewing or clearing bypasses and the email safe-list from the settings page (DevTools only for now)
- Chrome Web Store listing
