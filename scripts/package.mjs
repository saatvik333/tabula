#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(rootDir, '..');
const distDir = join(projectRoot, 'dist');

async function pathExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function zipDir(sourceDir, outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await rm(outPath, { force: true }).catch(() => {});
  const output = createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir + '/', false);
    archive.finalize();
  });
}

(async () => {
  if (!(await pathExists(distDir))) {
    console.error('dist/ not found. Run `npm run build` first.');
    process.exit(1);
  }
  const chromeZip = join(projectRoot, 'tabula-chrome.zip');
  const firefoxZip = join(projectRoot, 'tabula-firefox.zip');

  await zipDir(distDir, chromeZip);
  await zipDir(distDir, firefoxZip);

  console.log('Packages created:', chromeZip, firefoxZip);
})();
