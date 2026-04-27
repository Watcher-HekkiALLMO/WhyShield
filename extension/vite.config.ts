import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.config";

// CRXJS handles MV3 manifest bundling, picks up HTML entry points referenced
// in the manifest (warning, sidepanel), and emits a Chrome-loadable dist/.
export default defineConfig({
  plugins: [crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
  },
});
