import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/character-review-main.js', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../src/character-workspace.js', import.meta.url), 'utf8');

test('Character Workshop builds selectable model controls from the shared catalog', () => {
  assert.match(main, /CHARACTER_REFERENCE_MODELS/);
  assert.match(main, /character-model-options/);
  assert.match(main, /量産モデル/);
  assert.match(main, /workspace\.selectModel/);
});

test('reference model selection stays review-only and is scoped to the selected actor', () => {
  assert.match(workspace, /characterReferenceModel/);
  assert.match(workspace, /selectedReference/);
  assert.match(workspace, /actor\.id === selectedId/);
  assert.match(workspace, /modelId = null/);
});
