import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('repository character production manifests and catalog classifications pass', () => {
  const text = execFileSync(process.execPath, ['scripts/check-character-production.mjs'], { encoding: 'utf8' });
  const result = JSON.parse(text);
  assert.equal(result.schema, 'character-production-check');
  assert.equal(result.ok, true, result.failures?.join('\n'));
  assert.equal(result.manifests.some(row => row.id === 'shino.reference.v2'), false);
});
