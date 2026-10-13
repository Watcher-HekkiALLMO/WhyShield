// Builds the extension and zips the *contents* of dist/ for the Chrome
// Web Store: manifest.json must sit at the zip root, not inside a dist/
// folder, or the upload is rejected. Run with `pnpm package` from
// /extension. Output: extension/release/whyshield-<version>.zip
// (release/ is gitignored).
//
// Excluded on purpose: Vite's own .vite/manifest.json (build metadata,
// not part of the extension), and anything that is not a regular file.
import { execSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(root, "dist");
const release = join(root, "release");

execSync("pnpm build", { cwd: root, stdio: "inherit" });

const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
const zipPath = join(release, `whyshield-${manifest.version}.zip`);
await mkdir(release, { recursive: true });

const listed = [];
await new Promise((resolvePromise, reject) => {
  const out = createWriteStream(zipPath);
  const zip = new ZipArchive({ zlib: { level: 9 } });
  out.on("close", resolvePromise);
  zip.on("error", reject);
  zip.on("entry", (entry) => listed.push(entry.name));
  zip.pipe(out);
  // `dot: true` so a stray dotfile would be *seen* and listed, not
  // silently skipped; .vite/ is then excluded by name. READMEs are
  // developer notes; the OFL license texts next to the fonts stay in,
  // the license asks that they travel with the font files.
  zip.glob("**/*", { cwd: dist, dot: true, ignore: [".vite/**", "**/README.md"] });
  zip.finalize();
});

const { size } = await stat(zipPath);
console.log(`\n${zipPath}  (${(size / 1024).toFixed(1)} KB, ${listed.length} files)`);
for (const name of listed.sort()) console.log(`  ${name}`);
