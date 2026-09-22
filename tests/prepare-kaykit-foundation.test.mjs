import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { KAYKIT_REVIEW_EQUIPMENT_FILES } from '../packages/characters/src/kaykit-foundation.js';
import { gitBlobSha, verifyKayKitBytes } from '../scripts/prepare-kaykit-foundation.mjs';

test('KayKit localization verifies Git blob identity, not only file length', () => {
  const bytes = Buffer.from('hello');
  assert.equal(gitBlobSha(bytes), 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
  const model = { label: 'fixture', source: { byteLength: 5, gitBlobSha: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0' } };
  assert.equal(verifyKayKitBytes(model, bytes), true);
  assert.throws(() => verifyKayKitBytes(model, Buffer.from('HELLO')), /Git blob mismatch/);
  assert.throws(() => verifyKayKitBytes(model, Buffer.from('hello!')), /byte length mismatch/);
});

test('generated KayKit review equipment stays outside deployment input hashes', () => {
  const paths = KAYKIT_REVIEW_EQUIPMENT_FILES.map(row => row.runtime.localPath);
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: paths.join('\n') + '\n'
  }).trim().split('\n').filter(Boolean);
  assert.deepEqual(ignored.sort(), [...paths].sort());
});
