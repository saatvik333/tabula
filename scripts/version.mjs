#!/usr/bin/env node
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(rootDir, '..');
import { readFile } from 'node:fs/promises';
const manifestRaw = await readFile(join(projectRoot, 'manifest.json'), 'utf8');
const { version } = JSON.parse(manifestRaw);
console.log(version);
