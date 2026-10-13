# WhyShield privacy policy

**Last updated: 2026-10-13.** Applies to WhyShield 1.0.0.

WhyShield is a Chrome extension that checks the websites you visit and the
emails you open in Gmail for signs of phishing, then explains in plain
English what it noticed. This policy says exactly what leaves your browser,
where it goes, how long it is kept, and what you can turn off. It is
written to match the code, and the code is open source at
<https://github.com/Watcher-HekkiALLMO/WhyShield>, so you can check it.

This page is also served at <https://whyshield-backend.knower.workers.dev/privacy>.

## The short version

- To check a website, WhyShield sends that page's web address to the
  WhyShield server.
- To check an email in Gmail, it sends the sender, the subject, the text of
  the message, and the links inside it.
- The server runs its own checks first. When those are not conclusive, it
  passes the same content to Anthropic's Claude API for a verdict. When you
  click **Explain why**, it passes the content to Claude for an explanation.
- The server stores only verdicts ("safe", "suspicious", or "malicious"
  with the reasons), under a one-way hash, for 24 hours. It does not store
  the full page address, the subject, the message text, or anything that
  identifies you. The reasons attached to a verdict may name the host, the
  sender address, or the link that was flagged.
- WhyShield has no accounts, no analytics, no advertising, and sells
  nothing to anyone.

## What is sent, and why

### Web addresses

Every time a tab navigates to a new page, the extension sends the full
address of that page (including the path and any query string) to the
WhyShield server, which returns a verdict. The address is what the server
needs to spot look-alike domains, suspicious endings, raw IP addresses,
and punycode tricks.

Addresses are **not** sent when:

- the site is on your **Trusted sites** list (the address never leaves
  your machine, not even to the local cache);
- you chose **Continue anyway** on that site in the last hour;
- the same page was checked in the last 24 hours (the verdict is reused
  from a cache in your browser);
- the address is a `chrome://`, `chrome-extension://`, `about:`, or
  `file://` address;
- the **Warn me about look-alike websites** setting is off.

Only top-level navigations are checked. Frames and embedded content inside
a page are not.

### Email contents (Gmail on the web only)

When you open a message in Gmail and the **Warn me about suspicious
emails** setting is on, the extension sends the WhyShield server:

- the sender's display name and address (the "From" line);
- the subject;
- the text of the message you opened, with quoted replies stripped out
  when Gmail marks them as quotes (the signature block is included);
- the web links inside that message, unwrapped from Gmail's click
  tracking so the server sees the real destinations.

It does **not** send the recipients, attachments, or other messages in
the thread, and it does not run at all while you are in your Sent, Drafts,
Scheduled, or Chats folders. (A message you wrote that sits inside a thread
you open elsewhere is checked like any other.)
This version does not read the Reply-To header or the authentication
headers (SPF, DKIM, DMARC) either, because Gmail does not show them in
the normal reading view.

The server shortens the message text to its first 4,000 characters before
handing it to Claude.

WhyShield runs on `mail.google.com` only. It does not read the contents of
any other website; for every other site it sees the address alone.

### Explanations

When you click **Explain why** on a warning, the extension sends the same
address or email fields again, together with the verdict, and the server
streams back a two-paragraph explanation written by Claude. Explanations
are not stored anywhere.

### An install id

On first run the extension generates a random id (a UUID) and sends it in
a header with every request. The server uses it only to count requests
per hour, so one broken or misbehaving install cannot use up the shared
Claude budget for everyone. The id is not derived from your Google account
or anything else about you, it is never written to a log, and reinstalling
the extension produces a new one.

### Your own Anthropic API key (optional)

If you paste your own Anthropic API key on the settings page, it is sent
in a header with every request and the server uses it for that request's
Claude calls instead of the shared key. The key is stored only in your
browser's local extension storage, never in Chrome Sync. The server reads
it once per request, hands it to the Anthropic client, and never stores,
caches, or logs it. See **Bring your own key** below.

## Where the data goes

1. **The WhyShield server.** A Cloudflare Worker at
   `https://whyshield-backend.knower.workers.dev`, operated by Miguel
   Cardenas. It runs rule-based checks first (look-alike domains,
   suspicious endings, IP-address hosts, punycode, urgency wording,
   sender spoofing, and similar). If those are conclusive, no AI service
   is involved at all.
2. **Anthropic.** When the rules are not conclusive, the server sends the
   address or the email fields to Anthropic's Claude API for a verdict.
   When you ask for an explanation, it sends them to Claude again.
   Anthropic processes that content under its own privacy policy
   (<https://www.anthropic.com/legal/privacy>) and states that content
   sent through its API is not used to train its models. WhyShield sends
   Anthropic no identifier for you: not the install id, nothing but the
   content being checked.
3. **Cloudflare.** Cloudflare hosts the server and, like any host, sees
   your connection details (such as your IP address) while a request is in
   flight. The WhyShield worker has request logging turned off and writes
   no logs of its own.

No one else. WhyShield does not query Google Safe Browsing, urlscan.io,
PhishTank, or any other third-party reputation service. There is no
analytics, no crash reporting, and no advertising network.

## What is stored, and for how long

### On the server (Cloudflare KV)

| What | Keyed by | Kept for |
|---|---|---|
| A verdict for a web page: verdict, confidence, reason codes, and a one-sentence explanation. The reasons and explanation may name the host (for example "paypa1.com looks one character off from paypal"). The full address with its path and query string is not stored. | A SHA-256 hash of the host and path | 24 hours |
| A verdict for an email: the same shape. The reasons may name the sender's address or domain and the specific link that was flagged. The subject and the message text are not stored. | A SHA-256 hash of the sender, subject, text, and links | 24 hours |
| A request counter | The install id and the current UTC hour | 2 hours |

Nothing else. Explanations are streamed and discarded. Request bodies are
never logged.

### In your browser (Chrome extension storage)

| What | Where | Kept for |
|---|---|---|
| Verdicts for pages you visited | local | 24 hours |
| Verdicts for emails you opened | local | 24 hours |
| Sites you chose **Continue anyway** on | local | 1 hour |
| Emails you marked as safe (by Gmail message id) | local | until you clear it |
| Settings: the two toggles, sensitivity, trusted sites, backend address | sync (follows your Chrome profile) | until you change them |
| Your Anthropic API key, if set | local only, never synced | until you clear it |
| A timestamp noting that Anthropic rejected your key, so the settings page can tell you | local | until your next successful save |
| The install id | local | until you uninstall |
| A "paused until" timestamp, if the server rate-limited you | local | until the next hour |
| The context for an open **Explain why** panel | session (wiped when Chrome closes) | deleted the moment the panel reads it |

Expired entries are dropped the next time they are looked up.
Uninstalling the extension removes all of it.

## What WhyShield never does

- It never reads the contents of any website other than Gmail. For every
  other site it sees only the address, and only at the moment you
  navigate there.
- It never reads passwords, form fields, cookies, or your browsing
  history. It sees navigations as they happen; it does not open your
  history.
- It never stores full page addresses, subjects, or message text on the
  server. A stored verdict can name the host, sender, or link it is
  about, and nothing more.
- It never sells data, shares it with advertisers, or uses it for anything
  other than returning the verdict and the explanation you asked for.
- It never creates an account, signs you in anywhere, or links anything to
  your Google account.
- It never downloads code or assets at runtime. Fonts and images are
  bundled in the extension.

## Bring your own key

By default, Claude calls are billed to the shared key the WhyShield server
holds. If you prefer, paste your own Anthropic API key on the settings
page. Every request then carries your key, and the server uses it for that
request's Claude calls. The key is stored in your browser's local storage
only (not Chrome Sync, so it does not travel to your other devices or to
Google), the server never stores or logs it, and if Anthropic rejects it
the settings page tells you instead of quietly switching back to the
shared key.

## Keeping data on your machine

- **Trusted sites.** Any host you list is skipped entirely: no cache
  lookup, no server request. Add the sites you visit most and visits to
  them are never sent to the WhyShield server. The list itself is a
  setting, so like your other settings it follows your Chrome profile
  through Chrome Sync if you have that turned on.
- **Turn a check off.** Either toggle on the settings page stops that
  kind of check completely. With email warnings off, nothing from Gmail is
  ever read.
- **Run your own server.** The backend is open source. Point the
  **Backend address** setting at your own deployment and your data goes
  there instead; the operator of that server is then responsible for it.

## Your controls

Everything above is on the extension's settings page (right-click the
WhyShield icon, then **Options**): both toggles, sensitivity, trusted
sites, the backend address, your API key, and **Reset to defaults**, which
also clears the key. Uninstalling the extension deletes all local data.

There is nothing on the server to delete that identifies you. Verdicts
expire on their own within 24 hours and counters within 2 hours.

## Changes to this policy

Changes are posted at the address at the top of this page with a new
date, and listed below.

## Contact

Miguel Cardenas, <machz0813@gmail.com>. You can also open an issue at
<https://github.com/Watcher-HekkiALLMO/WhyShield/issues>.

## Changelog

- **2026-10-13.** First version, for WhyShield 1.0.0.
