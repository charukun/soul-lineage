import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest, safeFile, inventory, restoreEntry } from '../scripts/deployment-files.mjs';
import { needsBuild } from '../scripts/deploy.mjs';
test('unchanged app retains its original version even when repository head advances', () => {
  const previous = { inputHash: 'same', legacy: false, version: { commit: 'previous' } };
  assert.equal(needsBuild({ inputHash: 'same', legacy: false }, previous), false);
  assert.equal(needsBuild({ inputHash: 'changed', legacy: false }, previous), true);
  assert.equal(needsBuild({ inputHash: 'same', legacy: true }, previous), true);
});
test('restore preserves bytes and rejects corrupted outputs or path traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soul-deploy-'));
  const bytes = Buffer.from('original published app');
  const entry = { path: 'prod/rinne', files: [{ path: 'index.html', sha256: digest(bytes), size: bytes.length }] };
  try {
    await restoreEntry(entry, root, 'https://example.com/', async () => new Response(bytes));
    assert.deepEqual(await readFile(join(root, 'prod/rinne/index.html')), bytes);
    await assert.rejects(restoreEntry(entry, root, 'https://example.com/', async () => new Response('corrupted')));
    for (const path of ['../escape', '/absolute', 'dev/../prod', 'https://other.com', 'dev//file']) assert.throws(() => safeFile(path));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('inventory and legacy restore omit hidden files but keep visible integrity checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soul-deploy-hidden-'));
  const source = join(root, 'source');
  const restoredRoot = join(root, 'restored');
  const visible = Buffer.from('visible app');
  const hidden = Buffer.from('git metadata');
  try {
    await mkdir(join(source, '.hidden'), { recursive: true });
    await writeFile(join(source, 'index.html'), visible);
    await writeFile(join(source, '.gitattributes'), hidden);
    await writeFile(join(source, '.hidden', 'secret.txt'), hidden);
    const listed = await inventory(source);
    assert.deepEqual(listed.map(file => file.path), ['index.html']);

    const entry = { path: 'dev/rinne', files: [
      { path: '.gitattributes', sha256: digest(hidden), size: hidden.length },
      { path: 'index.html', sha256: digest(visible), size: visible.length },
    ] };
    const requested = [];
    const retained = await restoreEntry(entry, restoredRoot, 'https://example.com/', async url => {
      requested.push(new URL(url).pathname);
      return new Response(visible);
    });
    assert.deepEqual(requested, ['/dev/rinne/index.html']);
    assert.deepEqual(retained.files.map(file => file.path), ['index.html']);
    assert.deepEqual(entry.files.map(file => file.path), ['index.html']);
    assert.deepEqual(await readFile(join(restoredRoot, 'dev/rinne/index.html')), visible);

    await assert.rejects(restoreEntry(
      { path: 'dev/rinne', files: [{ path: 'missing.js', sha256: digest(visible), size: visible.length }] },
      restoredRoot,
      'https://example.com/',
      async () => new Response(null, { status: 404 }),
    ), /HTTP 404/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
