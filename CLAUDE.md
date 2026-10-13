# WhyShield — Project Charter

## Identity
You are the engineering lead on **WhyShield**, an open-source Chrome browser
extension that detects phishing emails and spoofed websites in real time and
**explains in plain English why** something is suspicious. The differentiator
vs every existing tool (Bitdefender TrafficLight, Microsoft SmartScreen,
Guardio, Norton Safe Web) is the educational, AI-generated reasoning. Other
tools block silently; WhyShield teaches.

## Who you are working with
The product owner is new to coding (just started Python). They hold a
cybersecurity certificate, so they understand security concepts well but not
engineering concepts. They are driving you as a prompt engineer; they are not
writing code themselves.

Your obligations to them:
1. Before writing code, state what you're about to do and why.
2. After writing non-trivial code, walk through it line by line in plain English.
3. Product decisions (UI copy, defaults, what counts as "suspicious") — ASK FIRST.
4. Pure engineering decisions (library choice, file structure) — make the call,
   then tell them what you chose and why.
5. Never produce more than ~300 lines of code per turn without checking in.
6. When something fails, debug out loud, step by step.

## Product vision
A user with WhyShield installed gets two experiences:

**Website warnings.** Before any page loads, WhyShield silently checks the URL
for spoofing patterns (typosquats, recently registered look-alike domains,
suspicious TLDs on brand names, punycode tricks). If suspicious, an
interstitial appears:

  ⚠️ This site might not be the real PayPal.
  [Explain why]   [Go back]   [Continue anyway]

**Email warnings.** Inside Gmail (web), when the user opens an email, a
content script inspects From, Reply-To, Subject, body, and links. If
suspicious, a banner appears at the top of the email:

  ⚠️ This email shows signs of phishing.
  [Explain why]   [Mark as safe]   [Dismiss]

In both cases, "Explain why" opens Chrome's side panel, where Claude streams
in a calm, plain-English, two-paragraph explanation of what's off.

Tone everywhere: calm, helpful, educational — never alarmist. The user should
feel like they have a smart friend looking over their shoulder, not an
antivirus screaming at them.

## Brand identity
- Project name: **WhyShield**
- Mascot: **Watcher** — an existing original character the product owner has
  illustrated, used as the toolbar icon and the warning interstitial
  illustration. The hand-out "stop" pose appears on warnings; the calm pose
  represents safe states. (Integrated in session 8a; see Visual identity
  under Architecture.)

## Architecture (locked)

  [Chrome Extension (Manifest V3)]            [Cloudflare Worker]
    - TypeScript, no framework                  - TypeScript + Hono
    - Service worker (background)    HTTPS      - Heuristics layer
    - Content script (Gmail)        ─────►      - Google Safe Browsing API
    - Interstitial page                         - Anthropic Claude API
    - Side panel ("Explain why")    ◄─────      - Cloudflare KV cache
    - Options page                              - Per-install rate limiting

Stack:
  - Extension: TypeScript, Vite bundler, Manifest V3.
  - Backend:  Cloudflare Workers + Hono + Cloudflare KV.
  - AI:       Anthropic Claude (Sonnet for verdicts, Haiku for pre-filter).
  - Intel:    Google Safe Browsing, urlscan.io, PhishTank.
  - Repo:     monorepo with /extension and /backend.
  - Quality:  Biome (lint/format), Vitest (tests).
  - Secrets:  never committed. Backend uses Cloudflare env vars; the
              extension carries no secrets at all.

### Visual identity
- **Palette source:** `design/design-direction.html` (the "Make it
  Watcher" mockup). `extension/src/shared/theme.css` carries its hex
  values verbatim as `--w-*` custom properties, plus the font stacks,
  the outline treatment (3px border + flat offset shadow, never a blur),
  the verdict band (6px stripe keyed off `data-verdict`), and the three
  button styles. The warning page, side panel, and options page import
  it; nothing hard-codes a color outside it except the Gmail banner,
  which inlines the same values because a Shadow DOM inside Gmail
  cannot reach the file. Keep the two in sync.
- **Two tokens are not in the mockup**, both added for WCAG AA:
  `--w-crimson-text: #f04452` for crimson *as small text* (the mockup's
  #d11a2a is 3.6:1 on ink) and `--w-crystal-deep: #7c4de6` as the
  primary button fill (white on #8b5cf6 is 4.2:1). Primary hover goes
  darker, not lighter, for the same reason. Gold passes at 10.6:1 on
  ink, so it is used as-is. The band, X, and crack are not text and stay
  on the true crimson.
- **Motif rules.** The X watermark and the crack beside the headline
  render only when `verdict === "malicious"`; suspicious gets the gold
  band and nothing else; safe states show neither. Both are inline SVGs
  gated purely by CSS on `body[data-verdict]`. The Gmail banner gets
  palette and band only: no mascot, no watermark, 2px border, no offset
  shadow, system fonts. It lives inside Gmail's UI and should read as a
  note, not a poster.
- **Mascot.** Masters (2048px RGBA) live in `design/mascot/` and never
  ship. `pnpm render-mascot` in `/extension` (sharp, Lanczos, trim +
  6% margin) writes the shipped sizes to `extension/public/mascot/`:
  stop-pose 96/192 on the warning card, calm-face 44/88 in the side
  panel and options headers, icon 16/32/48/128 for the manifest.
  Outputs are committed; rerun only when a master changes. thinking.png
  is rendered (80/160) but unused so far; the side panel loading state
  is three crystal shards.
- **Mascot motion (side panel only).** The header calm-face "talks
  along" with the stream: one short nod per SSE chunk that appended
  text (150ms, rotate -2.5deg → +1deg → 0 with a 1px dip, ease-out,
  origin near the neck). sidepanel.ts adds a `nod` class and removes it
  on `animationend`/`animationcancel`; a flag blocks a new nod until the
  previous one ends, so chunk bursts don't jitter. In the streaming,
  complete, and error states a 1px, 3s ease-in-out "breathe" loop runs;
  nods happen only while streaming; no-data is fully still. The breathe
  animation stays at index 0 of the animation list in every rule so a
  nod never restarts it. `prefers-reduced-motion: reduce` removes every
  transform. CSS transforms on the existing 44px img, no extra assets.
- **Fonts are bundled, never fetched.** Space Grotesk (display, 500/700)
  and DM Sans (text, 400/500/700), Latin subset, as woff2 in
  `extension/public/fonts/` with their OFL license texts, declared via
  `@font-face` in theme.css. Every stack falls back to system fonts.
  Extensions must not phone home for assets.
- **Contrast (WCAG AA, 4.5:1 for small text).** text #f3eefa on ink
  16.9, on surface 15.4; body text #e3d9f0 on surface 12.9; muted
  #b9a8d4 on surface 8.0; crystal-hi #c4a7f7 on ink 9.4 (secondary
  button text 8.5 on surface); gold on ink 10.6, on gold wash 7.3;
  crimson-text on ink 5.2, on surface 4.7, on crimson wash 4.6; white on
  crystal-deep 5.2. Non-text only: crimson #d11a2a on ink 3.6.

### Streaming endpoints
- `POST /explain/url` returns SSE (`text/event-stream`).
- Each event: `data: ${JSON.stringify(textChunk)}\n\n`. JSON-encoded so embedded
  newlines and quotes pass through intact. Stream ends with `data: [DONE]\n\n`.
- Fail-open: on any Anthropic error the server emits a single static fallback
  chunk in the same shape and then `[DONE]`. Clients render fallback identically
  to a real stream — no special-case path.
- The streaming pipeline (`streamExplanation` in `/backend/src/explain.ts`) is
  decoupled from Hono Context so it will be reused for `/explain/email` later.

### Side panel context passing
- Warning page → background worker via
  `chrome.runtime.sendMessage({ type: "explain-context", context })`.
- Background writes the context to `chrome.storage.session` under
  `explain:tab-{tabId}`.
- Side panel on mount reads + **immediately deletes** the entry, then starts
  streaming. `chrome.storage.session` has the right TTL (wiped when the
  browser closes); tab-id keys avoid cross-tab leakage.
- "Multiple Explain Why clicks = fresh stream" works because the side panel
  listens to `chrome.storage.onChanged` and re-streams when its tab's key is
  rewritten.
- Reopening the side panel from the toolbar after consumption lands on the
  no-data state, by design.

### Gmail integration
- A content script (`extension/src/content/gmail.ts`) runs only on
  `https://mail.google.com/*`, bootstraps on `document_idle`, then waits
  for `[role="main"]` to mount before doing real work. Gmail's SPA shell
  loads asynchronously after `document_idle` — sometimes seconds later.
- DOM selectors are documented in a comment block at the top of
  `extension/src/content/extractors.ts`. We anchor on semantic attributes
  (`[data-legacy-message-id]`, `[email][name]`, `[role="main"] h2`) over
  class names where possible, since Gmail rotates class names. The one
  unavoidable class anchor is `.a3s` for the rendered message body —
  it's been stable for years but is the most likely thing to break when
  Gmail drifts.
- Per-message identity is `data-legacy-message-id` (preferred — it's the
  Gmail-API-stable id) with `data-message-id` as fallback. The safe-list
  is keyed on this id and **does NOT propagate**: a "Mark as safe" on
  one message does not blanket-trust replies, forwards, future emails
  from the same sender, or even other messages in the same thread.
  Phishers exploit exactly that kind of inherited trust by sending
  follow-ups from look-alike senders after a victim has whitelisted one
  "harmless" message. Same defensive scoping principle as the URL
  bypass-by-host rule.
- "Latest visible expanded" rule: among `[data-message-id]` nodes whose
  `.a3s` body has rendered height (`offsetHeight > 0`), the last in DOM
  order is what we analyze. If the user expands an older message, that
  becomes the latest expanded one and we re-analyze. Collapsed message
  stubs are skipped.
- Folder skip list: `#sent`, `#drafts`, `#scheduled`, `#chats`. Inbox,
  All Mail, search results, labels, spam, trash all get analyzed.
- Banner is wrapped in Shadow DOM attached to a host
  `<div data-whyshield-banner="<messageId>">`. Two reasons: Gmail's CSS
  can't bleed in and shift our layout, and our CSS can't escape and
  break Gmail's reading area. Inserted in document flow just before the
  message's `.a3s` body, never floats.
- Three banner buttons: Explain why → side panel via background's
  `explain-email-context` handler (which both stashes context AND opens
  the panel, since `chrome.sidePanel` isn't exposed to content scripts).
  Mark as safe → background `mark-email-safe` (no TTL). Dismiss →
  in-memory dismissed set in the content script, cleared on hashchange
  per the "navigating away and back reappears the banner" spec.
- Re-injection avoidance: the `analyze-email` background handler bundles
  a safe-list pre-check, so once a message is marked safe, the very next
  observer tick that fires after the banner removal asks for a verdict,
  hears `{ skipped: true }`, and quietly does nothing. No flicker, no
  re-injection.
- Gmail's outbound link rewrite: every `<a>` href in the body is wrapped
  as `https://www.google.com/url?q=<original>`. The link extractor
  unwraps to the original URL before sending to the backend — otherwise
  every link in every email would look like `google.com` to the
  typosquat detector and we'd never flag anything.

### Settings
- One helper, `getSettings()` in `extension/src/shared/settings.ts`,
  merges stored values over the defaults in `config.ts` and returns a
  typed `Settings`. Every consumer (background worker, Gmail content
  script, side panel, options page) calls it; nothing reads
  `chrome.storage` for these keys directly. Each stored field is
  type-checked and falls back to its default, and sensitivity is clamped
  to 0.5–0.9, so a malformed value can never crash a consumer.
- Settings are read **per event** (per navigation, per Gmail observer
  tick, per explain request), not once at startup, so a change on the
  options page applies on the next page load or email opened without
  reloading the extension.
- Storage split: backend URL, sensitivity, trusted hosts, and the two
  toggles live in `chrome.storage.sync`. The bring-your-own API key
  lives in `chrome.storage.local` only. Secrets must not ride Chrome
  Sync onto other devices or Google's servers.
- Trusted hosts are an **exact host match, lowercase, port kept**. No
  subdomain inheritance, same rule as the Continue-anyway bypass list.
  A trusted host skips analysis entirely: no cache lookup, no backend
  call, so the host never leaves the machine. **URL-only by decision**:
  sender addresses are spoofable, so trusting a host on the email side
  would open a hole exactly where phishing lives. The link-typosquat
  heuristic already leaves exact-match links to real brands alone.
- All backend requests go through `postToBackend()` in
  `extension/src/shared/backend.ts`, which resolves the user's backend
  URL and attaches `X-WhyShield-API-Key` when a key is set. The backend
  (`apiKeyFor()` in `/backend/src/index.ts`) uses that key for the
  request's Claude calls instead of its own, never logs it, never caches
  it. The header must stay in the backend's CORS `allowHeaders` or the
  side panel's preflight fails (the background worker bypasses CORS via
  host_permissions; extension pages don't).
- Options page is `options_ui` with `open_in_tab: true`. The save is
  all-or-nothing: an invalid backend URL or an unparseable trusted-host
  line blocks the whole save with an inline message. Lines are parsed as
  URLs so a pasted `https://PayPal.com/login` saves as `paypal.com`.
  Reset to defaults also clears the API key.
- Email-warnings toggle: off at bootstrap means the Gmail observer is
  never attached. A `chrome.storage.onChanged` listener starts it if the
  user turns the setting on with Gmail open. Turning it off mid-session
  is honored on the next observer tick.
- The Gmail content script uses `getContentScriptSettings()`, a
  key-free getter that reads only `emailWarnings` and `sensitivity` from
  `chrome.storage.sync` and never touches the local area. The script
  runs inside the mail.google.com tab; Chrome's isolated world keeps
  page JavaScript out, but the API key has no reason to enter that
  context at all. This is the one sanctioned exception to "every
  consumer calls getSettings()". The underlying rule, no direct
  `chrome.storage` reads outside settings.ts, still holds.
- Rejected BYOK keys never fail silently. When Anthropic refuses a
  user-supplied key, the backend answers `401 { error: "byok-rejected" }`
  instead of a generic failure, and does **not** fall back to the shared
  key. `postToBackend()` sees that status, writes `byokRejectedAt` to
  `chrome.storage.local`, and the options page shows a calm notice under
  the key field until the next successful save clears the flag. Without
  this, a mistyped key would turn every uncached check into a fail-open
  with no sign to the user that protection was gone. The explain routes
  open the model stream before starting the SSE response for the same
  reason: once SSE headers go out, the status can't change.
- Remote backends must be `https://`. `http://` is accepted only for
  `localhost`, `127.0.0.1`, and `[::1]`, because the request carries the
  user's key and email contents.
- **Documented trade-off: backend URL lives in sync storage.** The
  security reviewer noted that a writer to the synced blob (a compromised
  Google account, or another device signed in to it) could repoint the
  backend and the next request would carry the local key and email
  content to that origin. We keep the URL in sync anyway: the threat
  model already requires a compromised Google account, at which point
  the user's Gmail itself is exposed, and moving the URL to local
  storage would break settings sync for that narrow gain.

## Known v2 priorities

These are deliberate post-v1 items captured here so future sessions don't
lose track of them. None block v1 (URL + email warning loops). Roughly
ordered by user-visible impact.

### Internationalization (i18n)
- Spanish first — largest underserved phishing-target population in the
  US, and existing security tools (Defender, Norton, Guardio) underserve
  this group.
- Then Portuguese, French, Mandarin (rough order, revisit at decision
  time).
- Four layers of work:
  1. Static UI strings via chrome.i18n.getMessage() with
     _locales/{lang}/messages.json files.
  2. Heuristic explanation templates in
     /backend/src/heuristics/index.ts — localized per language, backend
     receives Accept-Language hint from the extension.
  3. Claude system prompts get a "Respond in {locale}" instruction.
     (Easiest of the four — single prompt edit + param pass.)
  4. Phishing keyword corpus per language. Phrases like "su cuenta ha
     sido suspendida" must be researched and curated, not translated
     from the English list.

### Heuristic tuning
Surfaced during smoke testing:
- Typosquat heuristic should also try matching against the FIRST label
  of a multi-word domain (e.g., "amaz0n" from "amaz0n-shipping.tk"),
  not only the registrable domain. Currently we miss these.
- Combined-signal scoring: a suspicious TLD plus a brand keyword in the
  host name should score higher than the TLD alone. Currently each
  heuristic fires independently with no compounding.
- Prize-fraud / reward-scam emails ("you've won a gift card") don't
  trigger the banner — no urgency language, no credential request, no
  typosquat link, so heuristics are inconclusive and Haiku rates them
  below 0.7. Needs either a reward-scam keyword heuristic or a lower
  threshold for brand-impersonation-in-subject + unknown sender.

### Settings page (shipped in session 6; leftovers)
Whitelist, sensitivity slider, backend URL override, and BYOK all
landed. Still open:
- BYOK does not yet raise the user's effective rate limit, because
  per-install rate limiting itself isn't implemented (see Production
  deploy). When it is, requests carrying a user key should be exempt.
- No way to view or clear the 1-hour Continue-anyway bypasses or the
  per-message email safe-list from the options page. Today that's a
  DevTools trip (documented in extension/README.md).
- When the extension is rate-limited (429), show a notice on the options
  page like the BYOK-rejected one: "WhyShield is paused until [time]
  because it hit its hourly limit." Currently silent: the cooldown in
  shared/backend.ts is honored per path family until the next UTC hour,
  but nothing tells the user that protection is paused.

### Production deploy (shipped in session 7; leftovers)
Worker, KV, secret, rate limiting, and the Vite-mode URL switch all
landed; see the Deployment section. Still open:
- Hard monthly spending cap on the Anthropic account before public
  launch.
- Workers Paid plan (or every-Nth-request counter writes) before public
  launch, so the KV write budget doesn't silently turn off caching and
  the KV layer of rate limiting.
- Durable Object counter if approximate rate limiting ever proves
  insufficient.

### Tooling upgrades
- @crxjs/vite-plugin off the 2.0.0-beta.28 (currently flagged
  deprecated). Deferrable until it bites.
- (Wrangler 3 → 4 landed in session 7, along with
  @cloudflare/workers-types 4 → 5 as its required peer.)

### Privacy options
- Optional local-model mode via Ollama. Routes analysis to a
  user-provided local Llama / Phi instance instead of the cloud worker.
  Slower, less accurate, but zero data leaves the user's machine.
  Opt-in setting on the settings page.

### Distribution
- Chrome Web Store listing (privacy policy, screenshots, description,
  Single-Purpose statement).
- Apply for Anthropic OSS / startup API credits once the project has
  visible traction.

## Deployment
- **Live worker:** `https://whyshield-backend.knower.workers.dev`
  (Cloudflare Workers, name `whyshield-backend`, workers.dev subdomain
  `knower`, account owned by the product owner). `wrangler.toml` sets
  `workers_dev = true` and `preview_urls = false`: a security backend
  gets exactly one live hostname, no per-version preview URLs.
- **Deploy:** `cd backend && npx wrangler deploy`. Requires a Cloudflare
  login on the machine (`npx wrangler login`, browser OAuth). Deploys are
  reversible with `npx wrangler rollback` or `npx wrangler delete`.
- **Secrets:** `ANTHROPIC_API_KEY` is a worker secret, set once with
  `npx wrangler secret put ANTHROPIC_API_KEY` (prompts; paste the value).
  It is never in any file. Locally the same name comes from the
  gitignored `.dev.vars`. There is no other secret.
- **KV:** one namespace, `VERDICT_CACHE`, id in `wrangler.toml`. Holds
  the 24h verdict cache and the rate-limit counters. The id is a resource
  identifier, not a credential, so committing it is fine. Wrangler 4's
  `kv key list/get` commands default to the **local** Miniflare store;
  pass `--remote` to inspect production.
- **Rate limits** (`/backend/src/rate-limit.ts`): per install, per UTC
  clock hour, 200 for `/analyze/*` and 50 for `/explain/*`. Explain is
  tighter because each call is a Sonnet stream, roughly 10x a Haiku
  verdict, and no human reads 50 explanations an hour. The install id is
  a random UUID the extension mints once (`shared/install-id.ts`) and
  sends as `X-WhyShield-Install`; it is not linked to any account and is
  never logged or echoed. Missing or malformed id → 400; over the limit →
  `429 { error: "rate-limited" }`. The extension then stops calling that
  path family until the next UTC hour (cooldown per family in
  `shared/backend.ts`) and fails open.
- **Why two counting layers.** KV reads come from a per-location cache
  up to 60s stale and there is no atomic increment, so a 200-request
  burst from one place never trips a KV-only counter (observed in
  production during session 7). An in-memory counter per worker isolate
  catches bursts instantly; KV carries the count across time and
  locations; the effective count is the max. Approximate under
  multi-location bursts by design. Exact enforcement would need a
  Durable Object: a v2 item if abuse ever shows up.
- **KV free-tier budget:** 1,000 writes/day. Every counted request is one
  KV write, plus one per uncached verdict. Past the daily cap KV puts
  throw and both caching and the KV layer of rate limiting fail open
  (memory still counts). Fine for development traffic; before public
  launch, move to Workers Paid or cut counter writes to every Nth
  request.
- **Extension URL switch:** `shared/config.ts` picks the backend by Vite
  mode at build time. `pnpm build` (production) bakes in the live URL;
  `pnpm dev` (development) uses `http://localhost:8787`. No manual
  switching. The settings page can still override either.
- **One-time setup for a fresh account or fork:** `npx wrangler login` →
  `npx wrangler kv namespace create VERDICT_CACHE` and put the id in
  `wrangler.toml` → `npx wrangler secret put ANTHROPIC_API_KEY` → register
  a workers.dev subdomain when `deploy` asks → `npx wrangler deploy` →
  put the printed URL in `PRODUCTION_BACKEND_URL` in
  `extension/src/shared/config.ts`.
- **Still open before public launch:** hard monthly spending cap on the
  Anthropic account.

## Local development
- Backend: `cd backend && pnpm dev` (runs `wrangler dev`, wrangler 4).
  Local by default; Miniflare simulates KV in-memory and ignores the
  namespace id in `backend/wrangler.toml`, so local runs never touch the
  production namespace even though the real id is checked in. **Do not**
  try to use `--kv VERDICT_CACHE` as a wrangler flag; that flag does not
  exist. The rate limiter runs locally too, against the in-memory KV, so
  a curl loop can hit 429 on localhost without any deploy.
- Backend dev server should print `Ready on http://127.0.0.1:8787` with
  no warnings. (The wrangler 3 era had two expected warnings; the
  upgrade to wrangler 4 in session 7 removed both.)
- Extension: `cd extension && pnpm dev` (Vite + CRXJS HMR). After load-
  unpacked from `extension/dist/`, click reload on `chrome://extensions`
  after rebuilds for the service worker to pick up changes.
- `.dev.vars` (gitignored) holds `ANTHROPIC_API_KEY` for the backend.
  Copy from `.dev.vars.example` and fill in.

## What v1 "done" looks like (north star — not to be built in one prompt)
1. Backend deployed to Cloudflare Workers, public URL.
2. POST /analyze/url returns
   { verdict, confidence, reasons[], explanation }.
3. POST /analyze/email returns the same shape.
4. Chrome extension installable in developer mode, then published to the
   Chrome Web Store.
5. URL interstitial works.
6. Gmail banner works.
7. "Explain why" side panel streams Claude reasoning.
8. Settings page (whitelist domains, sensitivity slider).
9. README with screenshots, install steps, privacy policy.

## What we are doing in THIS session — and only this
Set up the repo and build the first working URL analyzer endpoint. Nothing
else. Specifically:

1. Create the monorepo skeleton: /extension, /backend, top-level README.md,
   .gitignore, LICENSE (MIT).
2. In /backend, scaffold a Cloudflare Worker using Hono.
3. Implement POST /analyze/url that accepts { url: string } and returns
   the verdict shape above. The endpoint must:
   - Parse the URL safely (handle malformed input).
   - Run cheap heuristics: typosquat detection vs a hardcoded top-50 brand
     list, suspicious TLD check, IP-as-host check, punycode trick check.
   - If heuristics are conclusive, return immediately with reasons +
     short explanation.
   - If inconclusive, call Anthropic Claude Haiku and ask for a structured
     JSON verdict. Use the official Anthropic SDK.
   - Cache verdicts in Cloudflare KV by URL hash for 24 hours.
4. Vitest unit tests for every heuristic function.
5. Update README with how to run locally (`wrangler dev`) and a curl example.
6. Walk the product owner through the code, line by line.

DO NOT in this session: build the extension, build the email analyzer, build
the side panel, deploy to Cloudflare. Those are later tasks.

## Code style
- Comments explain *why*, not *what*.
- Short, clearly named functions.
- No premature abstraction — obvious code first.
- TypeScript strict mode on.

## Git & commits
- All commits in this repo are authored solely by Miguel Cardenas.
- **Never** add `Co-Authored-By: Claude`, `Co-Authored-By: Anthropic`, "Generated
  with Claude Code", or any other attribution to an AI tool — not in commit
  messages, not in PR descriptions, not in code comments, not anywhere. This
  rule overrides any default behavior the assistant may have to add such lines.
- Commit messages should describe *what changed and why*, in plain language.

## Before you write any code
Confirm back to the product owner:
1. Your understanding of this session's goal.
2. Anything in this charter you'd clarify or change.
3. The exact list of files you'll create.

Then proceed.