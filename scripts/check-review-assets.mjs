import { existsSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'dist/rinne');
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const WARN_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_ASSET_FILES = 20_000;

if (!existsSync(root)) {
  console.error(`Review asset check failed: output directory not found: ${root}`);
  process.exit(1);
}

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push({ path: relative(root, full), bytes: statSync(full).size });
  }
}
walk(root);

const oversized = files.filter(file => file.bytes > MAX_ASSET_BYTES).sort((a, b) => b.bytes - a.bytes);
const nearLimit = files.filter(file => file.bytes >= WARN_ASSET_BYTES && file.bytes <= MAX_ASSET_BYTES).sort((a, b) => b.bytes - a.bytes);
let failed = false;

if (files.length > MAX_ASSET_FILES) {
  failed = true;
  console.error(`Review preview has ${files.length.toLocaleString()} static files; Workers Static Assets supports at most ${MAX_ASSET_FILES.toLocaleString()}.`);
}

if (oversized.length) {
  failed = true;
  console.error('Review preview contains static assets larger than 25 MiB:');
  for (const file of oversized) console.error(`  ${file.path}: ${(file.bytes / 1024 / 1024).toFixed(2)} MiB`);
  console.error('Move oversized review assets to the approved large-asset path (for example R2) and reference them by URL instead of bundling them.');
}

if (nearLimit.length) {
  console.warn('Review preview assets approaching the 25 MiB per-file limit:');
  for (const file of nearLimit.slice(0, 20)) console.warn(`  ${file.path}: ${(file.bytes / 1024 / 1024).toFixed(2)} MiB`);
}

if (failed) process.exit(1);
console.log(`Review asset limits OK: ${files.length.toLocaleString()} files, no asset exceeds 25 MiB.`);
