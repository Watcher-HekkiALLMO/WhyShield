# Chrome Web Store privacy practices form

The developer dashboard has a **Privacy practices** tab with three parts:
a single-purpose description, a per-permission justification, and a data
usage disclosure. This file holds the answers. Each one was checked
against the code paths named next to it; if the code changes, change the
answer.

## Single purpose

> WhyShield checks the websites you visit and the emails you open in Gmail
> for signs of phishing, warns you, and explains in plain English what it
> noticed.

## Permission justifications

Copied from `store/permissions.md`; that file has the longer reasoning.

- **webNavigation**: Used to receive the address of each top-level
  navigation before the page renders, so the address can be checked and a
  warning shown in its place. It is the only way to see the address
  without a host permission on every site.
- **storage**: Used for the extension's settings, a 24-hour cache of
  verdicts, one-hour "Continue anyway" choices, the list of emails the
  user marked as safe, a random per-install id, and, if the user supplies
  one, their own Anthropic API key (local storage only).
- **sidePanel**: Used to open the "Explain why" panel, where the
  explanation streams in.
- **Host permissions**: none requested. The content script's own
  `matches` entry covers `https://mail.google.com/*`; justification: the
  Gmail integration reads the open message's sender, subject, text, and
  links to check them for phishing signs and to show a banner above the
  message.
- **Remote code**: No. All JavaScript, fonts, and images ship inside the
  package. The extension fetches JSON verdicts and a text stream from the
  backend; it never loads or evaluates code from the network.

## Data usage: what to tick

The form lists data categories. Tick these:

| Category | Answer | Why (code path) |
|---|---|---|
| Personally identifiable information | **No** | Nothing about the user (name, address, email, age) is collected. Sender addresses of emails the user reads are covered under personal communications below. |
| Health information | No | |
| Financial and payment information | No | |
| Authentication information | **Yes** | Only if the user pastes their own Anthropic API key on the settings page. It is sent as a request header to the backend, which uses it for that request's Claude calls and never stores it (`extension/src/shared/backend.ts`, `apiKeyFor()` in `backend/src/index.ts`). Nothing is collected if the field is empty, which is the default. |
| Personal communications | **Yes** | Sender, subject, message text (Gmail-marked quoted replies stripped), and links of each Gmail message the user opens are sent to the backend for a verdict (`extension/src/content/extractors.ts`, `POST /analyze/email`) and, on "Explain why", for an explanation. The backend stores only a hashed-key verdict for 24 hours; the verdict's reasons may name the sender or a flagged link, never the subject or text. |
| Location | No | The backend never asks for or stores location. Cloudflare sees the connection's IP address in transit, as any host does; the worker keeps no logs. |
| Web history | **Yes** | The address of every top-level navigation is sent to the backend for a verdict (`chrome.webNavigation.onBeforeNavigate` in `extension/src/background/index.ts`, `POST /analyze/url`). The backend stores only a hashed-key verdict for 24 hours; the verdict's reasons may name the host, never the full address. |
| User activity | No | No clicks, scrolls, keystrokes, or usage telemetry. The random install id counts requests per hour on the server and is not linked to a person. |
| Website content | **Yes** | Text and links of Gmail messages (see personal communications). No content is read from any other site. |

### Certifications

Tick all three. Each is true of the shipped code:

- **I do not sell or transfer user data to third parties, outside of the
  approved use cases.** Data goes to the WhyShield backend (the
  developer's own service) and, for the verdict or explanation itself, to
  Anthropic's API as a service provider. That is the approved
  "providing the extension's core functionality" use.
- **I do not use or transfer user data for purposes that are unrelated to
  my item's single purpose.** The only use is returning a verdict and an
  explanation.
- **I do not use or transfer user data to determine creditworthiness or
  for lending purposes.**

### Privacy policy URL

`https://whyshield-backend.knower.workers.dev/privacy`

## Things the reviewer might ask about

- **Why is web history "Yes" when nothing is stored?** The form asks what
  is collected, meaning transmitted off the device, not what is retained.
  Addresses are transmitted. Answering "No" would be inaccurate.
- **Why no host permissions when the extension warns on every site?** The
  address comes from the `webNavigation` event, which does not require
  host access. The warning page is an extension page the extension opens
  in the tab itself with `chrome.tabs.update`.
- **Why "Authentication information: Yes"?** Honest answer for the
  optional bring-your-own-key field. If that answer causes trouble in
  review, the alternative is to remove the field from v1, not to answer
  "No".
