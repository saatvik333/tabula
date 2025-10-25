import { cp, mkdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(rootDir, "..");
const distDir = join(projectRoot, "dist");

await rm(distDir, { recursive: true, force: true }).catch(() => {});

await viteBuild({ configFile: join(projectRoot, "vite.config.ts") });

const newtabSource = join(distDir, "src", "pages", "newtab", "index.html");
const optionsSource = join(distDir, "src", "pages", "options", "index.html");

await mkdir(distDir, { recursive: true });

if (!existsSync(newtabSource) || !existsSync(optionsSource)) {
  throw new Error("Expected Vite output is missing. Ensure the pages were bundled correctly.");
}

await rm(join(distDir, "newtab.html"), { force: true }).catch(() => {});
await rm(join(distDir, "options.html"), { force: true }).catch(() => {});

await rename(newtabSource, join(distDir, "newtab.html"));
await rename(optionsSource, join(distDir, "options.html"));

await rm(join(distDir, "src"), { recursive: true, force: true }).catch(() => {});

// Load manifest and optionally patch for release/CI
import { readFile, writeFile } from 'node:fs/promises';
const manifestPath = join(projectRoot, "manifest.json");
const manifestOut = join(distDir, "manifest.json");
const manifestRaw = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestRaw);

if (process.env.CI || process.env.RELEASE_BUILD) {
  manifest.browser_specific_settings = manifest.browser_specific_settings || {};
  manifest.browser_specific_settings.gecko = manifest.browser_specific_settings.gecko || {};
  manifest.browser_specific_settings.gecko.data_collection = {
    collects_data: false,
    policy_url: "",
    data_collection_permissions: {},
  };
}

await writeFile(manifestOut, JSON.stringify(manifest, null, 2));
await cp(join(projectRoot, "src", "assets", "icons"), join(distDir, "icons"), { recursive: true });

// PNG icons are already provided in src/assets/icons; no rasterization needed.

console.log("Build complete.");
