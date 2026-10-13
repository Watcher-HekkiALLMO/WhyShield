// Static pages served by the worker: the privacy policy the Web Store
// listing links to, and a short about page. Plain HTML on the Watcher
// palette, no JavaScript, no external requests. Kept in the worker so
// the policy has a live https URL with zero extra infrastructure. The
// text lives in store/privacy-policy.md; this file renders the same
// content. Keep the two in step when the policy changes, and bump the
// date in both.

const POLICY_DATE = "2026-10-13";
const POLICY_VERSION = "1.0.0";
const REPO = "https://github.com/Watcher-HekkiALLMO/WhyShield";
const CONTACT = "machz0813@gmail.com";

const PALETTE_CSS = `
  :root { --ink:#120a1f; --surface:#1f1235; --line:#4a2c7a; --line-soft:#332052;
          --text:#f3eefa; --body:#e3d9f0; --muted:#b9a8d4; --crystal-hi:#c4a7f7; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ink); color:var(--body);
         font: 16px/1.6 "DM Sans","Segoe UI",system-ui,sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  header { display:flex; align-items:baseline; gap:12px; margin-bottom: 28px; }
  header b { font-family:"Space Grotesk","Segoe UI",system-ui,sans-serif; font-size:13px;
             letter-spacing:.08em; text-transform:uppercase; color:#fff; }
  header span { font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
  h1 { font-family:"Space Grotesk","Segoe UI",system-ui,sans-serif; font-size:28px;
       color:#fff; margin:0 0 6px; letter-spacing:-.01em; }
  h2 { font-family:"Space Grotesk","Segoe UI",system-ui,sans-serif; font-size:11px;
       letter-spacing:.16em; text-transform:uppercase; color:var(--crystal-hi);
       display:flex; align-items:center; gap:8px; margin:32px 0 10px; }
  h2::after { content:""; flex:1; height:2px; background:var(--line-soft); }
  h3 { font-family:"Space Grotesk","Segoe UI",system-ui,sans-serif; font-size:16px;
       color:#fff; margin:22px 0 6px; }
  p, li { color:var(--body); }
  .dated { color:var(--muted); font-size:14px; margin:0 0 24px; }
  a { color:var(--crystal-hi); }
  ul, ol { padding-left: 20px; }
  li + li { margin-top: 6px; }
  .card { background:var(--surface); border:3px solid var(--line);
          box-shadow:6px 6px 0 var(--line-soft); padding:22px 24px; margin:24px 0; }
  .card ul { margin: 0; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 14px; color:#fff; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 12px 0; }
  th, td { text-align: left; vertical-align: top; padding: 8px 10px;
           border-bottom: 1px solid var(--line-soft); }
  th { color:var(--muted); font-weight:500; font-size:12px; letter-spacing:.08em;
       text-transform:uppercase; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 2px solid var(--line-soft);
           font-size: 13px; color: var(--muted); }
`;

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · WhyShield</title>
<style>${PALETTE_CSS}</style>
</head>
<body>
<main>
<header><b>WhyShield</b><span>${title}</span></header>
${body}
<footer>WhyShield is open source: <a href="${REPO}">${REPO.replace("https://", "")}</a>
· <a href="/privacy">Privacy policy</a> · <a href="/about">About</a></footer>
</main>
</body>
</html>
`;
}

// Mirrors store/privacy-policy.md section for section.
export const PRIVACY_HTML = layout(
  "Privacy policy",
  `<h1>Privacy policy</h1>
<p class="dated">Last updated ${POLICY_DATE}. Applies to WhyShield ${POLICY_VERSION}.</p>

<p>WhyShield is a Chrome extension that checks the websites you visit and the emails you
open in Gmail for signs of phishing, then explains in plain English what it noticed. This
policy says exactly what leaves your browser, where it goes, how long it is kept, and what
you can turn off. It is written to match the code, and the code is open source at
<a href="${REPO}">${REPO.replace("https://", "")}</a>, so you can check it.</p>

<div class="card">
<ul>
<li>To check a website, WhyShield sends that page's web address to the WhyShield server.</li>
<li>To check an email in Gmail, it sends the sender, the subject, the text of the message,
and the links inside it.</li>
<li>The server runs its own checks first. When those are not conclusive, it passes the same
content to Anthropic's Claude API for a verdict. When you click <b>Explain why</b>, it passes
the content to Claude for an explanation.</li>
<li>The server stores only verdicts ("safe", "suspicious", or "malicious" with the reasons),
under a one-way hash, for 24 hours. It does not store the full page address, the subject, the
message text, or anything that identifies you. The reasons attached to a verdict may name the
host, the sender address, or the link that was flagged.</li>
<li>WhyShield has no accounts, no analytics, no advertising, and sells nothing to anyone.</li>
</ul>
</div>

<h2>What is sent, and why</h2>

<h3>Web addresses</h3>
<p>Every time a tab navigates to a new page, the extension sends the full address of that
page (including the path and any query string) to the WhyShield server, which returns a
verdict. The address is what the server needs to spot look-alike domains, suspicious endings,
raw IP addresses, and punycode tricks.</p>
<p>Addresses are <b>not</b> sent when:</p>
<ul>
<li>the site is on your <b>Trusted sites</b> list (the address never leaves your machine, not
even to the local cache);</li>
<li>you chose <b>Continue anyway</b> on that site in the last hour;</li>
<li>the same page was checked in the last 24 hours (the verdict is reused from a cache in
your browser);</li>
<li>the address is a <code>chrome://</code>, <code>chrome-extension://</code>,
<code>about:</code>, or <code>file://</code> address;</li>
<li>the <b>Warn me about look-alike websites</b> setting is off.</li>
</ul>
<p>Only top-level navigations are checked. Frames and embedded content inside a page are
not.</p>

<h3>Email contents (Gmail on the web only)</h3>
<p>When you open a message in Gmail and the <b>Warn me about suspicious emails</b> setting is
on, the extension sends the WhyShield server:</p>
<ul>
<li>the sender's display name and address (the "From" line);</li>
<li>the subject;</li>
<li>the text of the message you opened, with quoted replies stripped out when Gmail marks
them as quotes (the signature block is included);</li>
<li>the web links inside that message, unwrapped from Gmail's click tracking so the server
sees the real destinations.</li>
</ul>
<p>It does <b>not</b> send the recipients, attachments, or other messages in the thread, and
it does not run at all while you are in your Sent, Drafts, Scheduled, or Chats folders. (A
message you wrote that sits inside a thread you open elsewhere is checked like any other.)
This version does not read the
Reply-To header or the authentication headers (SPF, DKIM, DMARC) either, because Gmail does
not show them in the normal reading view.</p>
<p>The server shortens the message text to its first 4,000 characters before handing it to
Claude.</p>
<p>WhyShield runs on <code>mail.google.com</code> only. It does not read the contents of any
other website; for every other site it sees the address alone.</p>

<h3>Explanations</h3>
<p>When you click <b>Explain why</b> on a warning, the extension sends the same address or
email fields again, together with the verdict, and the server streams back a two-paragraph
explanation written by Claude. Explanations are not stored anywhere.</p>

<h3>An install id</h3>
<p>On first run the extension generates a random id (a UUID) and sends it in a header with
every request. The server uses it only to count requests per hour, so one broken or
misbehaving install cannot use up the shared Claude budget for everyone. The id is not
derived from your Google account or anything else about you, it is never written to a log,
and reinstalling the extension produces a new one.</p>

<h3>Your own Anthropic API key (optional)</h3>
<p>If you paste your own Anthropic API key on the settings page, it is sent in a header with
every request and the server uses it for that request's Claude calls instead of the shared
key. The key is stored only in your browser's local extension storage, never in Chrome Sync.
The server reads it once per request, hands it to the Anthropic client, and never stores,
caches, or logs it. See <b>Bring your own key</b> below.</p>

<h2>Where the data goes</h2>
<ol>
<li><b>The WhyShield server.</b> A Cloudflare Worker at
<code>https://whyshield-backend.knower.workers.dev</code>, operated by Miguel Cardenas. It
runs rule-based checks first (look-alike domains, suspicious endings, IP-address hosts,
punycode, urgency wording, sender spoofing, and similar). If those are conclusive, no AI
service is involved at all.</li>
<li><b>Anthropic.</b> When the rules are not conclusive, the server sends the address or the
email fields to Anthropic's Claude API for a verdict. When you ask for an explanation, it
sends them to Claude again. Anthropic processes that content under its own
<a href="https://www.anthropic.com/legal/privacy">privacy policy</a> and states that content
sent through its API is not used to train its models. WhyShield sends Anthropic no identifier
for you: not the install id, nothing but the content being checked.</li>
<li><b>Cloudflare.</b> Cloudflare hosts the server and, like any host, sees your connection
details (such as your IP address) while a request is in flight. The WhyShield worker has
request logging turned off and writes no logs of its own.</li>
</ol>
<p>No one else. WhyShield does not query Google Safe Browsing, urlscan.io, PhishTank, or any
other third-party reputation service. There is no analytics, no crash reporting, and no
advertising network.</p>

<h2>What is stored, and for how long</h2>

<h3>On the server (Cloudflare KV)</h3>
<table>
<tr><th>What</th><th>Keyed by</th><th>Kept for</th></tr>
<tr><td>A verdict for a web page: verdict, confidence, reason codes, and a one-sentence
explanation. The reasons and explanation may name the host (for example "paypa1.com looks one
character off from paypal"). The full address with its path and query string is not stored.</td>
<td>A SHA-256 hash of the host and path</td><td>24 hours</td></tr>
<tr><td>A verdict for an email: the same shape. The reasons may name the sender's address or
domain and the specific link that was flagged. The subject and the message text are not
stored.</td>
<td>A SHA-256 hash of the sender, subject, text, and links</td><td>24 hours</td></tr>
<tr><td>A request counter</td><td>The install id and the current UTC hour</td><td>2 hours</td></tr>
</table>
<p>Nothing else. Explanations are streamed and discarded. Request bodies are never logged.</p>

<h3>In your browser (Chrome extension storage)</h3>
<table>
<tr><th>What</th><th>Where</th><th>Kept for</th></tr>
<tr><td>Verdicts for pages you visited</td><td>local</td><td>24 hours</td></tr>
<tr><td>Verdicts for emails you opened</td><td>local</td><td>24 hours</td></tr>
<tr><td>Sites you chose <b>Continue anyway</b> on</td><td>local</td><td>1 hour</td></tr>
<tr><td>Emails you marked as safe (by Gmail message id)</td><td>local</td><td>until you clear it</td></tr>
<tr><td>Settings: the two toggles, sensitivity, trusted sites, backend address</td>
<td>sync (follows your Chrome profile)</td><td>until you change them</td></tr>
<tr><td>Your Anthropic API key, if set</td><td>local only, never synced</td><td>until you clear it</td></tr>
<tr><td>A timestamp noting that Anthropic rejected your key, so the settings page can tell you</td>
<td>local</td><td>until your next successful save</td></tr>
<tr><td>The install id</td><td>local</td><td>until you uninstall</td></tr>
<tr><td>A "paused until" timestamp, if the server rate-limited you</td><td>local</td><td>until the next hour</td></tr>
<tr><td>The context for an open <b>Explain why</b> panel</td>
<td>session (wiped when Chrome closes)</td><td>deleted the moment the panel reads it</td></tr>
</table>
<p>Expired entries are dropped the next time they are looked up. Uninstalling the extension
removes all of it.</p>

<h2>What WhyShield never does</h2>
<ul>
<li>It never reads the contents of any website other than Gmail. For every other site it
sees only the address, and only at the moment you navigate there.</li>
<li>It never reads passwords, form fields, cookies, or your browsing history. It sees
navigations as they happen; it does not open your history.</li>
<li>It never stores full page addresses, subjects, or message text on the server. A stored
verdict can name the host, sender, or link it is about, and nothing more.</li>
<li>It never sells data, shares it with advertisers, or uses it for anything other than
returning the verdict and the explanation you asked for.</li>
<li>It never creates an account, signs you in anywhere, or links anything to your Google
account.</li>
<li>It never downloads code or assets at runtime. Fonts and images are bundled in the
extension.</li>
</ul>

<h2>Bring your own key</h2>
<p>By default, Claude calls are billed to the shared key the WhyShield server holds. If you
prefer, paste your own Anthropic API key on the settings page. Every request then carries
your key, and the server uses it for that request's Claude calls. The key is stored in your
browser's local storage only (not Chrome Sync, so it does not travel to your other devices or
to Google), the server never stores or logs it, and if Anthropic rejects it the settings page
tells you instead of quietly switching back to the shared key.</p>

<h2>Keeping data on your machine</h2>
<ul>
<li><b>Trusted sites.</b> Any host you list is skipped entirely: no cache lookup, no server
request. Add the sites you visit most and visits to them are never sent to the WhyShield
server. The list itself is a setting, so like your other settings it follows your Chrome
profile through Chrome Sync if you have that turned on.</li>
<li><b>Turn a check off.</b> Either toggle on the settings page stops that kind of check
completely. With email warnings off, nothing from Gmail is ever read.</li>
<li><b>Run your own server.</b> The backend is open source. Point the <b>Backend address</b>
setting at your own deployment and your data goes there instead; the operator of that server
is then responsible for it.</li>
</ul>

<h2>Your controls</h2>
<p>Everything above is on the extension's settings page (right-click the WhyShield icon, then
<b>Options</b>): both toggles, sensitivity, trusted sites, the backend address, your API key,
and <b>Reset to defaults</b>, which also clears the key. Uninstalling the extension deletes
all local data.</p>
<p>There is nothing on the server to delete that identifies you. Verdicts expire on their own
within 24 hours and counters within 2 hours.</p>

<h2>Changes to this policy</h2>
<p>Changes are posted at this address with a new date, and listed in the changelog below.</p>

<h2>Contact</h2>
<p>Miguel Cardenas, <a href="mailto:${CONTACT}">${CONTACT}</a>. You can also open an issue at
<a href="${REPO}/issues">${REPO.replace("https://", "")}/issues</a>.</p>

<h2>Changelog</h2>
<ul>
<li><b>${POLICY_DATE}.</b> First version, for WhyShield ${POLICY_VERSION}.</li>
</ul>`,
);

export const ABOUT_HTML = layout(
  "About",
  `<h1>About WhyShield</h1>
<p class="dated">Version ${POLICY_VERSION}.</p>

<p>WhyShield is a free, open-source Chrome extension that checks the websites you visit and
the emails you open in Gmail for signs of phishing, warns you before you act, and then
explains in plain English what gave it away.</p>

<p>Most security tools block silently. WhyShield teaches. Every warning has an
<b>Explain why</b> button that opens a side panel where a calm, two-paragraph explanation
streams in: which part of the address is the look-alike, why "your account will be suspended
in 24 hours" is a common phishing trick, why the link in the email doesn't go where the text
says it does. The idea is that after a few warnings you start spotting these yourself.</p>

<h2>How it works</h2>
<ul>
<li>Before a page loads, the address is checked for look-alike domains, suspicious endings,
raw IP addresses, and punycode tricks.</li>
<li>In Gmail, the message you open is checked for a sender name that doesn't match the
address, urgency wording, requests for passwords or payment details, and links to look-alike
sites.</li>
<li>Checks start with rule-based heuristics on this server. When those aren't conclusive, the
server asks Anthropic's Claude for a judgment. Explanations are written by Claude.</li>
</ul>

<h2>What this server is</h2>
<p>This is the WhyShield backend, a Cloudflare Worker. It answers the extension's requests
and serves this page and the <a href="/privacy">privacy policy</a>. It stores verdicts under
a one-way hash for 24 hours and per-install request counters for two hours, nothing else; the
policy has the details. You can also run
your own copy and point the extension at it from the settings page.</p>

<h2>Open source</h2>
<p>MIT licensed. The extension, this server, the heuristics, the prompts, and the privacy
policy are all at <a href="${REPO}">${REPO.replace("https://", "")}</a>. Issues and pull
requests are welcome.</p>

<h2>Contact</h2>
<p>Miguel Cardenas, <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>

<p class="dated">Watcher, the character on the warning page and the toolbar icon, is an
original character by the author.</p>`,
);
