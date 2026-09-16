import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const qa = fs.readFileSync(new URL('../src/character-art-qa.js', import.meta.url), 'utf8');

test('Character Workshop exposes the shared six-check refinement loop', () => {
  assert.match(qa, /CHARACTER_REFINEMENT_CHECKS/);
  assert.match(qa, /CHARACTER_REFINEMENT_MAX_ROUNDS/);
  assert.match(qa, /CHARACTER_REFINEMENT_VIEWS/);
  assert.match(qa, /createCharacterRefinementRound/);
  assert.match(qa, /形状リファイン/);
  assert.match(qa, /FAILだけ次のラウンドへ/);
  assert.match(qa, /PASS領域は固定し、FAIL部位だけ修正/);
});

test('refinement UI keeps human visual approval separate and exposes machine-readable state', () => {
  assert.match(qa, /Visual Approvalは従来どおり別判定/);
  assert.match(qa, /__CHARACTER_REFINEMENT_POLICY__/);
  assert.match(qa, /__CHARACTER_REFINEMENT_STATE__/);
  assert.match(qa, /unresolved-failed-parts-only|未解決部位だけ外部参照/);
});
