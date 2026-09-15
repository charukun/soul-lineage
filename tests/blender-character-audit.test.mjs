import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/blender/character-production-audit.py', 'utf8');

test('Blender audit is headless-friendly evidence, not visual approval', () => {
  assert.match(source, /--out/);
  assert.match(source, /--character-id/);
  assert.match(source, /meshObjects/);
  assert.match(source, /triangles/);
  assert.match(source, /singleArmature/);
  assert.match(source, /hasUVs/);
  assert.match(source, /transformsApplied/);
  assert.match(source, /"visualApproval": "pending"/);
  assert.doesNotMatch(source, /requests|urllib|http:/);
});
