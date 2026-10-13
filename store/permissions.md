# Permission justifications

What the manifest asks for, the code that needs it, and the sentence to
paste into the developer dashboard's per-permission justification box.
The reviewer reads the manifest, not this file; this file is so the
justifications stay true to the code.

Manifest source: `extension/manifest.config.ts`. Built manifest:
`extension/dist/manifest.json` after `pnpm build`.

## Requested

### `webNavigation`

- **Code:** `chrome.webNavigation.onBeforeNavigate` in
  `extension/src/background/index.ts`. The handler filters to the top
  frame, skips `chrome://` and similar schemes, trusted hosts, and recent
  bypasses, then fetches or reuses a verdict and, if the verdict warrants
  it, replaces the tab's URL with the extension's warning page.
- **Why this and not a host permission:** the event delivers the URL on
  its own. Without it the only way to see a navigation is a content
  script or `tabs` listener on every site, which would need `<all_urls>`.
  This is the narrowest grant that gives a URL before the page renders.
- **Paste:** Used to receive the address of each top-level navigation
  before the page renders, so it can be checked for look-alike domains
  and other phishing signs and a warning page shown in its place. No
  host permission is requested; the event is the only source of the
  address.

### `storage`

- **Code:** `chrome.storage.local` in `extension/src/background/storage.ts`
  (24h verdict caches, 1h host bypasses, per-message email safe-list),
  `extension/src/shared/install-id.ts` (random install id),
  `extension/src/shared/settings.ts` (API key in local; toggles,
  sensitivity, trusted hosts, backend URL in `chrome.storage.sync`),
  `extension/src/shared/backend.ts` (rate-limit cooldown timestamp), and
  `chrome.storage.session` in the background worker and side panel
  (per-tab "Explain why" context, deleted on read).
- **Paste:** Used for the user's settings, a 24-hour cache of verdicts
  so the same page or email is not checked twice, one-hour "Continue
  anyway" choices, the list of emails the user marked as safe, a random
  per-install id for rate limiting, and the user's own Anthropic API key
  if they choose to supply one (kept in local storage only, never
  synced).

### `sidePanel`

- **Code:** `chrome.sidePanel.open` in `extension/src/warning/warning.ts`
  (from the warning page's own click) and in the background worker's
  `explain-email-context` handler (on behalf of the Gmail banner, since
  content scripts cannot call it). `side_panel.default_path` points at
  `src/sidepanel/index.html`.
- **Paste:** Used to open the "Explain why" panel, where a plain-English
  explanation of the warning streams in next to the page or email it is
  about.

### Content script on `https://mail.google.com/*`

Not a permission, but the dashboard asks for a host justification for
any `matches` entry.

- **Code:** `extension/src/content/gmail.ts` and `extractors.ts`. Waits
  for Gmail's reading pane, reads the open message's sender, subject,
  body text, and links, asks the background worker for a verdict, and
  inserts a banner (in a Shadow DOM) above the message when warranted.
- **Paste:** The extension runs a script on Gmail only, to read the
  sender, subject, text, and links of the message the user has open,
  check them for phishing signs, and show a banner above the message.
  It reads no other site.

## Not requested, and why the reviewer will not find a need for them

- **`tabs`:** `tabs.update`, `tabs.remove`, and `tabs.query` work without
  it. The permission only gates reading a tab's `url`, `title`, and
  `favIconUrl`, which nothing in the code does. Verified in session 8b by
  loading the trimmed build in Chrome for Testing and navigating to
  `paypa1.com`: the redirect to the warning page fired.
- **`host_permissions` / `<all_urls>`:** no page content is read outside
  Gmail, and the Gmail script is injected by its own `matches` entry.
  Backend requests from the service worker and the side panel both go
  through ordinary CORS, which the worker answers for any
  `chrome-extension://` origin (`backend/src/index.ts`).
- **`web_accessible_resources` for the warning page:** the extension
  opens the page itself with `tabs.update`; no website needs to load it.
  Removing the entry also means a site cannot open the warning page with
  crafted parameters. The built manifest still carries a CRXJS-generated
  entry scoped to `https://mail.google.com/*` for the content script's
  own JavaScript chunks; that is how the bundler loads split modules
  into the content script, and it grants nothing to page scripts.
- **`scripting`, `activeTab`, `declarativeNetRequest`, `history`,
  `cookies`:** none used.

## Remote code

**No.** Every script, font, and image ships in the package. Network
traffic is JSON verdicts and a text/event-stream of explanation text
from the backend. Nothing fetched is executed.

## What is sent to the backend (say this plainly if asked)

| Trigger | Endpoint | Body |
|---|---|---|
| Any top-level navigation not cached, trusted, or bypassed | `POST /analyze/url` | `{ url }`: the full address |
| Opening a message in Gmail (email warnings on) | `POST /analyze/email` | `{ from, subject, body, links[] }`: sender line, subject, message text with Gmail-marked quoted replies stripped, link destinations |
| "Explain why" on a site warning | `POST /explain/url` | the address plus the verdict, confidence, and reason codes |
| "Explain why" on an email banner | `POST /explain/email` | the same email fields plus the verdict, confidence, and reason codes |

Every request carries `X-WhyShield-Install` (random UUID, rate limiting
only) and, if the user set one, `X-WhyShield-API-Key`. The backend stores
verdicts under a SHA-256 key for 24 hours and request counters for 2
hours. A verdict's reasons may name the host, sender, or flagged link it
is about; it stores no full addresses, no subjects or message text, no
keys, and writes no logs. Full text: `store/privacy-policy.md`, served at
`https://whyshield-backend.knower.workers.dev/privacy`.

## If the submission is rejected over permissions

Reply from the dashboard. Template, fill the bracketed part with the
reviewer's exact wording:

> Thank you for the review. Regarding [the flagged permission or
> behaviour]:
>
> WhyShield requests three permissions (webNavigation, storage,
> sidePanel) and one content-script match (https://mail.google.com/*).
> It requests no host permissions and no access to the content of any
> site other than Gmail.
>
> webNavigation is the source of the page address the extension checks;
> the check happens on the extension's own server and the result is a
> warning page the extension opens in the tab. storage holds settings
> and caches. sidePanel shows the explanation. The Gmail script reads
> the open message's sender, subject, text, and links to check them for
> phishing signs.
>
> The data sent to the server, what is stored (verdicts only, hashed
> key, 24 hours), and what is never stored are described at
> https://whyshield-backend.knower.workers.dev/privacy, and the complete
> source is at https://github.com/Watcher-HekkiALLMO/WhyShield.
>
> If a specific permission or data flow is the concern, I am happy to
> narrow it; please point me at the line in the policy or the file in
> the repository.
