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

await cp(join(projectRoot, "manifest.json"), join(distDir, "manifest.json"));
await cp(join(projectRoot, "src", "assets", "icons"), join(distDir, "icons"), { recursive: true });

// Rasterize SVG icons to PNG for Chrome Web Store compatibility
try {
 const sharp = (await import('sharp')).default;
 const iconSizes = [16, 32, 48, 128];
 const iconBase = join(projectRoot, 'src', 'assets', 'icons');
 const outBase = join(distDir, 'icons');
 const files = [
   { in: 'icon16.svg', out: 'icon16.png', size: 16 },
   { in: 'icon32.svg', out: 'icon32.png', size: 32 },
   { in: 'icon48.svg', out: 'icon48.png', size: 48 },
   { in: 'icon128.svg', out: 'icon128.png', size: 128 },
 ];
 for (const f of files) {
   await sharp(join(iconBase, f.in)).resize(f.size, f.size).png().toFile(join(outBase, f.out));
 }
 console.log('Icons rasterized to PNG.');
} catch (e) {
 console.warn('Icon rasterization skipped (sharp not installed):', e?.message || e);
}

console.log("Build complete.");
