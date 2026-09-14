import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dedupeSite } from '../scripts/site-dedupe.mjs';

test('identical published bytes become hardlinks without changing content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'site-dedupe-'));
  await mkdir(join(root, 'dev'), { recursive: true });
  await mkdir(join(root, 'staging'), { recursive: true });
  const bytes = 'x'.repeat(8192);
  await writeFile(join(root, 'dev', 'asset.bin'), bytes);
  await writeFile(join(root, 'staging', 'asset.bin'), bytes);
  const report = await dedupeSite(root);
  assert.equal(report.linkedFiles, 1);
  assert.equal(report.bytesSaved, 8192);
  const a = await stat(join(root, 'dev', 'asset.bin'));
  const b = await stat(join(root, 'staging', 'asset.bin'));
  assert.equal(a.ino, b.ino);
});

test('different bytes never dedupe even when size matches', async () => {
  const root = await mkdtemp(join(tmpdir(), 'site-dedupe-'));
  await writeFile(join(root, 'a.bin'), 'a'.repeat(8192));
  await writeFile(join(root, 'b.bin'), 'b'.repeat(8192));
  const report = await dedupeSite(root);
  assert.equal(report.linkedFiles, 0);
});
