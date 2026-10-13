import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.config";

const here = dirname(fileURLToPath(import.meta.url));

// CRXJS handles MV3 manifest bundling but in 2.0.0-beta.28 it does NOT
// register web_accessible_resources HTML pages (or the side_panel page)
// as Rollup entries. Without that registration, Vite copies the HTML
// through verbatim and never rewrites <link> / <script> refs to the
// bundled outputs, so the warning page loads its source-path CSS/TS and
// 404s.
//
// Listing both HTML pages explicitly as Rollup inputs forces Vite's HTML
// processor to run, which emits warning.css and the bundled warning.ts
// alongside the HTML and rewrites the references. Sidepanel has no
// external refs today but is listed for symmetry and future-proofing.
export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        warning: resolve(here, "src/warning/index.html"),
        sidepanel: resolve(here, "src/sidepanel/index.html"),
        options: resolve(here, "src/options/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
