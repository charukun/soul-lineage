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

test('reference catalog keeps runtime identities and upgrades Shino to audited DCC PRIMARY', () => {
  assert.deepEqual(Object.keys(CHARACTER_REFERENCE_MODELS), EXPECTED);
  const assets = new Set();
  for (const id of EXPECTED) {
    const model = characterReferenceModel(id);
    assert.equal(model.masterId, MASTER_ID);
    assert.equal(model.id, id);
    assert.equal(model.profile, model.parts);
    assert.doesNotThrow(() => validateVisualIdentity(model));
    assert.equal(model.referenceStyle.version, 1);
    assert.ok(model.referenceStyle.scale > .5 && model.referenceStyle.scale <= 1);
    assert.equal(Object.isFrozen(model), true);
    assert.equal(Object.isFrozen(model.profile), true);
    assert.equal(Object.isFrozen(model.referenceStyle), true);
    if (id === 'shino.reference.v2') {
      assert.equal(model.kind, 'dcc-character-model');
      assert.equal(model.assetId, 'character.shino-reference-v2.dcc.v1');
      assert.equal(model.productionStage, 'PRIMARY');
      assert.equal(model.modelingMode, 'dcc-blender');
      assert.equal(model.productionReady, false);
      assert.match(model.assetPath, /SHINO_REFERENCE_V2\.vrm$/);
      assert.match(model.integrityPath, /SHINO_REFERENCE_V2\.asset\.json$/);
    } else {
      assert.equal(model.kind, 'runtime-reference-model');
    }
    assert.ok(!assets.has(model.assetId), `duplicate runtime asset id: ${model.assetId}`);
    assets.add(model.assetId);
  }
});

test('every reference model points at a committed sheet and declares its runtime/DCC contract', () => {
  for (const model of Object.values(CHARACTER_REFERENCE_MODELS)) {
    const sheet = new URL(`../../../${model.referencePath}`, import.meta.url);
    assert.ok(statSync(sheet).size > 0, model.referencePath);
    if (model.kind === 'dcc-character-model') assert.match(model.note, /DCC PRIMARY/);
    else assert.match(model.note, /ランタイム3D/);
  }
  assert.throws(() => characterReferenceModel('unknown.reference'), /Unknown character reference model/);
});
