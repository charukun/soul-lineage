import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, lstat, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function filesUnder(root) {
  const result = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) result.push(path);
    }
  }
  await walk(root);
  return result;
}

async function digest(path) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', resolvePromise);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

export async function dedupeSite(root, { minBytes = 4096 } = {}) {
  const absolute = resolve(root);
  const candidates = [];
  for (const path of await filesUnder(absolute)) {
    const stat = await lstat(path);
    if (stat.isFile() && stat.size >= minBytes) candidates.push({ path, size: stat.size, mode: stat.mode & 0o777, ino: stat.ino });
  }
  const sizeBuckets = new Map();
  for (const file of candidates) {
    const key = `${file.size}:${file.mode}`;
    if (!sizeBuckets.has(key)) sizeBuckets.set(key, []);
    sizeBuckets.get(key).push(file);
  }
  let linkedFiles = 0;
  let bytesSaved = 0;
  const hashes = new Map();
  for (const bucket of sizeBuckets.values()) {
    if (bucket.length < 2) continue;
    const canonical = new Map();
    for (const file of bucket) {
      const hash = await digest(file.path);
      const key = `${file.size}:${file.mode}:${hash}`;
      const first = canonical.get(key);
      if (!first) { canonical.set(key, file); continue; }
      const current = await lstat(file.path);
      const source = await lstat(first.path);
      if (current.ino === source.ino && current.dev === source.dev) continue;
      await unlink(file.path);
      await link(first.path, file.path);
      linkedFiles++;
      bytesSaved += file.size;
      hashes.set(file.path, first.path);
    }
  }
  return { root: absolute, scannedFiles: candidates.length, linkedFiles, bytesSaved, links: Object.fromEntries(hashes) };
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node scripts/site-dedupe.mjs <site-root>');
  const report = await dedupeSite(root);
  console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
