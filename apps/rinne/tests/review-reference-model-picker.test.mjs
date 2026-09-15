import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_REFERENCE_MODELS, reviewReferenceModel } from '../src/review/reference-character-models.js';
import { MOTION_LIBRARY_MODELS, motionLibraryModel, motionLibraryModelURL } from '../src/review/motion-library-models.js';

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

test('Visual Review Lab restores all five Motion Library characters', () => {
  assert.equal(MOTION_LIBRARY_MODELS.length, 5);
  assert.deepEqual(MOTION_LIBRARY_MODELS.map(row => row.label), ['Knight','Barbarian','Mage','Rogue','Rogue Hooded']);
  for (const row of MOTION_LIBRARY_MODELS) {
    assert.equal(motionLibraryModel(row.presetId), row);
    assert.equal(motionLibraryModel(row.id), row);
    assert.ok(motionLibraryModelURL(row).endsWith('/' + row.file));
  }
});
