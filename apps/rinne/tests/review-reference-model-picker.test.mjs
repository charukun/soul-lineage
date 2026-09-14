import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_REFERENCE_MODELS, reviewReferenceModel } from '../src/review/reference-character-models.js';

test('Visual Review Lab exposes all eleven runtime reference models', () => {
  assert.equal(REVIEW_REFERENCE_MODELS.length, 11);
  assert.deepEqual(REVIEW_REFERENCE_MODELS.map(row => row.id), [
    'shino.reference.v2','child-boy.reference.v1','child-girl.reference.v1','elderly-man.reference.v1','elderly-woman.reference.v1',
    'guard.reference.v1','knight.reference.v1','blacksmith.reference.v1','laborer.reference.v1','hunter.reference.v1','arcanist.reference.v1'
  ]);
  for (const row of REVIEW_REFERENCE_MODELS) {
    assert.equal(row.sourcePresetId, 'model.SHINO');
    assert.ok(row.referenceStyle?.design);
    assert.ok(row.referenceStyle?.palette);
    assert.equal(reviewReferenceModel(row.id), row);
  }
});
