import { defineManifest } from "@crxjs/vite-plugin";

// Manifest V3. Permissions are the minimum the shipped code calls, each
// justified for the Web Store reviewer in store/permissions.md:
// - webNavigation: onBeforeNavigate delivers every top-level navigation
//                  URL so it can be checked before the page renders. The
//                  permission alone supplies the URL; no host permission
//                  is involved.
// - storage:       verdict cache, 1h host bypasses, email safe-list,
//                  settings (sync), install id and BYOK key (local),
//                  per-tab explain context (session).
// - sidePanel:     open the "Explain why" panel from the warning page
//                  and, via the worker, from the Gmail banner.
//
// Deliberately absent:
// - tabs:          tabs.update / tabs.remove / tabs.query work without
//                  it; it is only needed to read a tab's url, title, or
//                  favicon, which nothing here does.
// - host_permissions: the Gmail content script is injected by its own
//                  `matches` entry, and every backend request goes
//                  through ordinary CORS (the worker allows any
//                  chrome-extension:// origin). Nothing reads page
//                  content on arbitrary sites.
// - web_accessible_resources: the warning page is opened by the
//                  extension itself (tabs.update), never by a website,
//                  so no site needs access to it.
const MASCOT_ICONS = {
  16: "mascot/icon-16.png",
  32: "mascot/icon-32.png",
  48: "mascot/icon-48.png",
  128: "mascot/icon-128.png",
};

export default defineManifest({
  manifest_version: 3,
  name: "WhyShield",
  version: "1.0.0",
  // Doubles as the Web Store summary (132-char limit); keep in sync with
  // store/listing.md.
  description:
    "Spots look-alike websites and phishing emails in Gmail, then explains in plain English what gave them away.",
  homepage_url: "https://github.com/Watcher-HekkiALLMO/WhyShield",
  permissions: ["webNavigation", "storage", "sidePanel"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  // The Gmail content script bootstraps on document_idle so the SPA shell
  // is already mounted; the script's own MutationObserver waits for the
  // [role="main"] anchor before doing real work. `matches` is the only
  // grant it needs.
  content_scripts: [
    {
      matches: ["https://mail.google.com/*"],
      js: ["src/content/gmail.ts"],
      run_at: "document_idle",
    },
  ],
  // Watcher icon, rendered from design/mascot/icon.png by
  // `pnpm render-mascot`. Chrome picks the size it needs per surface.
  action: {
    default_icon: MASCOT_ICONS,
    default_title: "WhyShield",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  // open_in_tab rather than the embedded chrome://extensions popup: the
  // page has a textarea and a password field, and the popup's fixed
  // small viewport makes both awkward.
  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },
  icons: MASCOT_ICONS,
});
