import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { MASTER_ID } from '../src/master-character.js';
import { validateVisualIdentity } from '../src/visual-identity.js';
import { CHARACTER_REFERENCE_MODELS, characterReferenceModel } from '../src/reference-models.js';

const EXPECTED = [
  'shino.reference.v2',
  'child-boy.reference.v1',
  'child-girl.reference.v1',
  'elderly-man.reference.v1',
  'elderly-woman.reference.v1',
  'guard.reference.v1',
  'knight.reference.v1',
  'blacksmith.reference.v1',
  'laborer.reference.v1',
  'hunter.reference.v1',
  'arcanist.reference.v1'
];

test('reference catalog exposes every Character References page model as runtime 3D identity', () => {
  assert.deepEqual(Object.keys(CHARACTER_REFERENCE_MODELS), EXPECTED);
  const assets = new Set();
  for (const id of EXPECTED) {
    const model = characterReferenceModel(id);
    assert.equal(model.masterId, MASTER_ID);
    assert.equal(model.kind, 'runtime-reference-model');
    assert.equal(model.id, id);
    assert.equal(model.profile, model.parts);
    assert.doesNotThrow(() => validateVisualIdentity(model));
    assert.equal(model.referenceStyle.version, 1);
    assert.ok(model.referenceStyle.scale > .5 && model.referenceStyle.scale <= 1);
    assert.equal(Object.isFrozen(model), true);
    assert.equal(Object.isFrozen(model.profile), true);
    assert.equal(Object.isFrozen(model.referenceStyle), true);
    assert.ok(!assets.has(model.assetId), `duplicate runtime asset id: ${model.assetId}`);
    assets.add(model.assetId);
  }
});

test('every runtime reference model points at a committed reference sheet', () => {
  for (const model of Object.values(CHARACTER_REFERENCE_MODELS)) {
    const sheet = new URL(`../../../${model.referencePath}`, import.meta.url);
    assert.ok(statSync(sheet).size > 0, model.referencePath);
    assert.match(model.note, /ランタイム3D/);
  }
  assert.throws(() => characterReferenceModel('unknown.reference'), /Unknown character reference model/);
});
