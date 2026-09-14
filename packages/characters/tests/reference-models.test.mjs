import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { MASTER_ID } from '../src/master-character.js';
import { BASE_APPEARANCE_PARTS } from '../src/appearance-parts.js';
import { CHARACTER_REFERENCE_MODELS, characterReferenceModel } from '../src/reference-models.js';

test('Shino Reference v2 is a dedicated DCC asset on the audited humanoid contract', () => {
  const model = characterReferenceModel('shino.reference.v2');
  assert.equal(model.masterId, MASTER_ID);
  assert.equal(model.assetId, 'character.shino-reference-v2.dcc.v1');
  assert.equal(model.kind, 'dcc-character-model');
  assert.equal(model.productionStage, 'PRIMARY');
  assert.equal(model.modelingMode, 'dcc-blender');
  assert.equal(model.productionReady, false);
  assert.match(model.assetPath, /SHINO_REFERENCE_V2\.vrm$/);
  assert.match(model.integrityPath, /SHINO_REFERENCE_V2\.asset\.json$/);
  assert.deepEqual(model.profile, BASE_APPEARANCE_PARTS);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.profile), true);
});

test('reference catalog keeps the committed sheet and fails closed for unknown models', () => {
  const model = CHARACTER_REFERENCE_MODELS['shino.reference.v2'];
  const sheet = new URL(`../../../${model.referencePath}`, import.meta.url);
  assert.ok(statSync(sheet).size > 0);
  assert.throws(() => characterReferenceModel('unknown.reference'), /Unknown character reference model/);
  assert.match(model.note, /DCC PRIMARY/);
  assert.match(model.note, /Visual Approval|DEFORMATION/);
});
