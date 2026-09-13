import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { MASTER_ID } from '../src/master-character.js';
import { BASE_APPEARANCE_PARTS } from '../src/appearance-parts.js';
import { CHARACTER_REFERENCE_MODELS, characterReferenceModel } from '../src/reference-models.js';

test('Shino reference model is pinned to the audited MasterCharacter contract', () => {
  const model = characterReferenceModel('shino.reference.v2');
  assert.equal(model.masterId, MASTER_ID);
  assert.equal(model.assetId, MASTER_ID);
  assert.equal(model.kind, 'reference-preset');
  assert.deepEqual(model.profile, BASE_APPEARANCE_PARTS);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.profile), true);
});

test('reference catalog points at the committed Shino sheet and fails closed for unknown models', () => {
  const model = CHARACTER_REFERENCE_MODELS['shino.reference.v2'];
  const sheet = new URL(`../../../${model.referencePath}`, import.meta.url);
  assert.ok(statSync(sheet).size > 0);
  assert.throws(() => characterReferenceModel('unknown.reference'), /Unknown character reference model/);
  assert.match(model.note, /提案パーツ/);
});
