import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/character-review-main.js', import.meta.url), 'utf8');
const qa = fs.readFileSync(new URL('../src/character-art-qa.js', import.meta.url), 'utf8');

test('Character Workshop mounts the shared art/performance QA without a separate tool', () => {
  assert.match(main, /import '\.\/character-art-qa\.js';/);
  assert.match(qa, /stylizedArtAudit/);
  assert.match(qa, /compareStylizedSilhouettes/);
  assert.match(qa, /auditTextureBudget/);
  assert.match(qa, /Art \/ Performance QA/);
  assert.match(qa, /Motion LOD/);
  assert.match(qa, /全個体シルエット比較/);
  assert.match(qa, /__CHARACTER_ART_QA__/);
});

test('Shino Hero gate requires explicit Motion QA visual approval and combined equipment budget', () => {
  assert.match(qa, /character \+ equipment triangles/);
  assert.match(qa, /Motion QA has not been recorded/);
  assert.match(qa, /visualApproval === 'changes-requested'/);
  assert.match(qa, /visualApproval !== 'approved'/);
  assert.match(qa, /hero · SHINO GATE/);
});
