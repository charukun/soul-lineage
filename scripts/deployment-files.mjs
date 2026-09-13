import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function safeFile(path) {
  assert.ok(typeof path === 'string' && /^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').some(p => p === '..' || p === '.' || !p), `Unsafe deployment path: ${path}`);
  return path;
}
export function isPublishableFile(path) {
  safeFile(path);
  return path.split('/').every(part => !part.startsWith('.'));
}
export function publishableFiles(files) {
  assert.ok(Array.isArray(files), 'Deployment files must be an array');
  return files.filter(file => file && isPublishableFile(file.path));
}
export async function inventory(root) {
  const files = [];
  async function walk(dir = '') {
    for (const entry of await readdir(resolve(root, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = safeFile(dir ? `${dir}/${entry.name}` : entry.name);
      assert.ok(!entry.isSymbolicLink(), 'Symlinks are not publishable');
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) { const bytes = await readFile(resolve(root, path)); files.push({ path, sha256: digest(bytes), size: bytes.length }); }
    }
  }
  await walk(); return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function fetchBytes(url, request = fetch) {
  const response = await request(url, { signal: AbortSignal.timeout(60000), cache: 'no-store' });
  assert.equal(response.status, 200, `HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
export async function restoreEntry(entry, root, baseUrl, request = fetch) {
  safeFile(entry.path);
  const files = publishableFiles(entry.files);
  assert.ok(files.length > 0, `Deployment entry has no publishable files: ${entry.path}`);
  // Persist the sanitized legacy inventory so the next manifest permanently drops
  // hidden paths that GitHub Pages never exposed (for example .gitattributes).
  entry.files = files;
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      const url = new URL(`${entry.path}/${file.path}`, baseUrl);
      url.searchParams.set('content', file.sha256);
      const bytes = await fetchBytes(url, request);
      assert.equal(bytes.length, file.size, `Retained asset size: ${file.path}`);
      assert.equal(digest(bytes), file.sha256, `Retained asset hash: ${file.path}`);
      const target = resolve(root, entry.path, file.path);
      await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes);
    }
  }));
  return entry;
}
