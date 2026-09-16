import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTER_REFERENCE_MODELS } from '@soul/characters';

const main = readFileSync(new URL('../src/character-review-main.js', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../src/character-workspace.js', import.meta.url), 'utf8');
const review = readFileSync(new URL('../src/character-review.js', import.meta.url), 'utf8');

test('Character Workshop builds selectable model controls from the license-clean shared catalog', () => {
  assert.match(main, /CHARACTER_REFERENCE_MODELS/);
  assert.match(main, /character-model-options/);
  assert.match(main, /量産モデル/);
  assert.match(main, /workspace\.selectModel/);
  assert.equal(Object.hasOwn(CHARACTER_REFERENCE_MODELS, 'shino.reference.v2'), false);
  assert.equal(Object.hasOwn(CHARACTER_REFERENCE_MODELS, 'protagonist.villager.v1'), false);
  assert.equal(Object.hasOwn(CHARACTER_REFERENCE_MODELS, 'arcanist.atlas-dcc.v1'), false);
});

test('active reference model selection stays review-only and is scoped to the selected actor', () => {
  assert.match(workspace, /characterReferenceModel/);
  assert.match(workspace, /selectedReference/);
  assert.match(workspace, /actor\.id === selectedId/);
  assert.match(workspace, /modelId = null/);
});

test('Character Workshop exports a provider-neutral CC0-targeted model build request', () => {
  assert.match(main, /createCharacterModelBuildRequest/);
  assert.match(main, /モデル生成仕様JSON/);
  assert.match(main, /data-character-build-request|characterBuildRequest/);
  assert.match(main, /model-build-request\.json/);
});

test('default review loads pinned KayKit while retired DCC runtime models are refused', () => {
  assert.match(review, /KAYKIT_MODEL_BY_KEY\.knight/);
  assert.match(review, /kaykitHumanoidFromGLTF/);
  assert.match(review, /defaultModel\.source\.gitBlobSha/);
  assert.match(review, /DCCモデル .*旧carrier rig依存.*退役中/);
  assert.match(workspace, /loadDefaultModel/);
  assert.match(workspace, /loadReferenceModel/);
  assert.doesNotMatch(review, /auditCharacterRuntimeDocument/);
});
