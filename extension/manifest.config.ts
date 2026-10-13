import { defineManifest } from "@crxjs/vite-plugin";

// Manifest V3. Permissions kept narrow:
// - webNavigation: subscribe to onBeforeNavigate so we can intercept
//   top-level navigations before the page renders.
// - storage:       persist verdict cache + per-host bypasses.
// - sidePanel:     open the "Explain why" panel from the warning page.
// - tabs:          chrome.tabs.remove fallback when "Go back" is clicked
//                  on a tab with no history (typed-URL phishing case).
//
// host_permissions: needed because we read every navigation URL to analyze it.
const MASCOT_ICONS = {
  16: "mascot/icon-16.png",
  32: "mascot/icon-32.png",
  48: "mascot/icon-48.png",
  128: "mascot/icon-128.png",
};

export default defineManifest({
  manifest_version: 3,
  name: "WhyShield",
  version: "0.0.1",
  description:
    "Detects phishing emails and spoofed websites in real time, and explains in plain English why.",
  permissions: ["webNavigation", "storage", "sidePanel", "tabs"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  // The Gmail content script bootstraps on document_idle so the SPA shell
  // is already mounted; the script's own MutationObserver waits for the
  // [role="main"] anchor before doing real work. host_permissions
  // <all_urls> already covers mail.google.com, so no extra entry needed.
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
  web_accessible_resources: [
    {
      // The icon PNGs are referenced by Chrome itself (toolbar action,
      // icons), not by web pages, so they don't need to be web-accessible.
      // Listing public/ files here makes Vite double-emit them.
      resources: ["src/warning/index.html"],
      matches: ["<all_urls>"],
    },
  ],
  icons: MASCOT_ICONS,
});
