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
  represents safe states. (Mascot integration is later, not relevant to this
  session — recorded here for context.)

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

## Local development
- Backend: `cd backend && pnpm dev` (runs `wrangler dev`). Wrangler 3 is local
  by default and uses Miniflare to simulate KV in-memory. The
  `[[kv_namespaces]]` block in `backend/wrangler.toml` declares a fake
  placeholder id (`0000000000000000000000000000abcd`) — Miniflare ignores
  this id locally and provides a working in-memory namespace. **Do not** try
  to use `--kv VERDICT_CACHE` as a wrangler flag; that flag does not exist.
  Replace the placeholder id only when wiring up a real Cloudflare deploy.
- Backend dev server should print `Ready on http://127.0.0.1:8787`. Two
  warnings on startup are expected and safe to ignore: (a) "wrangler is
  out-of-date" (we're pinned to wrangler 3 deliberately for now) and (b) a
  compatibility-date fallback warning because our `compatibility_date` is
  newer than what wrangler 3's bundled workerd supports.
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