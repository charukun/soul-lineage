import test from 'node:test';
import assert from 'node:assert/strict';
import { gitBlobSha, verifyKayKitBytes } from '../scripts/prepare-kaykit-foundation.mjs';

test('KayKit localization verifies Git blob identity, not only file length', () => {
  const bytes = Buffer.from('hello');
  assert.equal(gitBlobSha(bytes), 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
  const model = { label: 'fixture', source: { byteLength: 5, gitBlobSha: 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0' } };
  assert.equal(verifyKayKitBytes(model, bytes), true);
  assert.throws(() => verifyKayKitBytes(model, Buffer.from('HELLO')), /Git blob mismatch/);
  assert.throws(() => verifyKayKitBytes(model, Buffer.from('hello!')), /byte length mismatch/);
});
