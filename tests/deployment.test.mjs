import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest, safeFile, restoreEntry } from '../scripts/deployment-files.mjs';
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
