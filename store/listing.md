# Chrome Web Store listing

Everything that gets pasted into the **Store listing** tab of the developer
dashboard. Limits are the store's. Paste as plain text; the description
field does not render Markdown.

## Name (45 characters max)

**WhyShield** (9)

Alternative if the store search needs more context: **WhyShield: Phishing
Warnings Explained** (39). The short name is the recommendation: the
summary line already carries the pitch, and the name is what shows on the
toolbar tooltip and in the extensions menu.

## Summary (132 characters max)

Three drafts. The first one is in the manifest and is the pick: it leads
with what the extension does, names Gmail so the content-script scope is
no surprise, and ends on the differentiator.

1. **Pick.** Spots look-alike websites and phishing emails in Gmail, then
   explains in plain English what gave them away. (107)
2. Warns you about look-alike sites and suspicious Gmail messages, and
   explains the phishing signs in plain English. (113)
3. A calm second look at the sites you visit and the emails you open.
   Warns you, then explains why in plain English. (113)

Keep the manifest `description` and this line identical.

## Category

**Privacy & Security.** The extension's single purpose is phishing
detection. "Productivity" and "Tools" would be defensible but would bury
it among unrelated items, and the reviewer's expectation for a security
category (clear data handling, minimal permissions) is one this listing
is written to meet.

## Language

English (United States).

## Description (16,000 characters max)

```
WhyShield checks the websites you visit and the emails you open in Gmail for signs of phishing, warns you before you act, and then explains in plain English what gave it away.

Most security tools block silently. WhyShield teaches. Every warning has an "Explain why" button that opens a side panel where a calm, two-paragraph explanation streams in: which part of the address is the look-alike, why "your account will be suspended in 24 hours" is a common phishing trick, why the link in the email doesn't go where the text says it does. The idea is that after a few warnings you start spotting these yourself.

WHAT IT CHECKS

Websites. Before a page loads, WhyShield checks its address for look-alike domains (paypa1.com instead of paypal.com), suspicious endings, raw IP addresses, and punycode tricks that make foreign characters look like Latin letters. If something looks off you see a warning page instead of the site, with Explain why, Go back, and Continue anyway.

Gmail. When you open an email in Gmail on the web, WhyShield looks at the sender, the subject, the message text, and the links inside it. If the message shows signs of phishing (a sender name that doesn't match the address, urgency language, a request for your password or payment details, a link to a look-alike site) a banner appears above the message with Explain why, Mark as safe, and Dismiss.

Both checks start with rule-based heuristics. When those aren't conclusive, the WhyShield server asks Anthropic's Claude for a judgment. Explanations are always written by Claude.

WHAT LEAVES YOUR BROWSER

Plain statement, because this is a security tool and you should know:
- To check a website, the address of the page is sent to the WhyShield server (a Cloudflare Worker run by the developer).
- To check an email, the sender, subject, message text, and links of the message you opened are sent to the same server. Nothing from other messages, attachments, recipients, or your Sent and Drafts folders.
- The server may pass that content to Anthropic's Claude API to form a verdict or write the explanation.
- The server stores only verdicts, under a one-way hash, for 24 hours. A verdict's reasons may name the host, sender, or link it flagged; the full address, subject, and message text are never stored, and the server keeps no logs.
- A random install id is sent to count requests per hour. It is not linked to you or your Google account.
- No accounts, no analytics, no ads, nothing sold. Full policy: https://whyshield-backend.knower.workers.dev/privacy

You can keep sites private by adding them to Trusted sites (they are never checked at all), turn either kind of warning off, or point the extension at your own copy of the server.

BRING YOUR OWN KEY

Claude calls are normally billed to the shared key the server holds, with a per-install hourly limit. If you would rather use your own Anthropic account, paste your API key on the settings page. It stays in your browser's local storage (never synced) and the server uses it only for your requests, without storing it.

SETTINGS

- Turn website warnings and email warnings on or off separately.
- Sensitivity: how confident WhyShield needs to be before a "suspicious" verdict shows a warning. Clear look-alike domains always warn.
- Trusted sites: hosts that are never checked.
- Backend address, for running your own server.
- Your own Anthropic API key (optional).

OPEN SOURCE

WhyShield is MIT licensed. Extension and server code, the heuristics, the prompts, and this privacy policy are all at https://github.com/Watcher-HekkiALLMO/WhyShield. Issues and pull requests welcome.

PERMISSIONS

webNavigation: to see the address of each page as you navigate to it. storage: settings and caches. sidePanel: the Explain why panel. The extension runs a script only on mail.google.com, and asks for no access to the content of any other site.

Watcher, the mascot on the warning page, is an original character by the developer.
```

Length: about 3,900 characters.

## Single purpose (privacy practices tab)

> WhyShield checks the websites you visit and the emails you open in Gmail
> for signs of phishing, warns you, and explains in plain English what it
> noticed.

## Other fields

- **Official URL:** `https://github.com/Watcher-HekkiALLMO/WhyShield`
  (the store verifies a site via Search Console; a GitHub URL cannot be
  verified, so leave it unverified or skip the field).
- **Homepage URL:** same as above (matches `homepage_url` in the manifest).
- **Support URL:** `https://github.com/Watcher-HekkiALLMO/WhyShield/issues`
- **Privacy policy URL:** `https://whyshield-backend.knower.workers.dev/privacy`
- **Mature content:** No.
- **Visibility:** Unlisted for the first submission; see `checklist.md`.

## Copy rules that apply to every field

Second person, calm. Never "attack", "danger", "threat", "fraud", or
"criminal". Say "looks like", "appears to", "a common phishing trick",
"may not be the real X". The store copy above was written to those rules;
keep edits inside them.
