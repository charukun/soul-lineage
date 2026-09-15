import assert from 'node:assert/strict';
import test from 'node:test';
import { REVIEW_REFERENCE_BY_ID, REVIEW_REFERENCE_MODELS } from '../src/review/reference-character-models.js';

test('Visual Review Lab exposes the Arcanist baseline and independent Atlas study', () => {
  const baseline = REVIEW_REFERENCE_BY_ID['arcanist.reference.v1'];
  const study = REVIEW_REFERENCE_BY_ID['arcanist.atlas-study.v1'];

  assert.ok(baseline, 'baseline Arcanist preset must remain available');
  assert.ok(study, 'Atlas study preset must be registered');
  assert.notEqual(study, baseline);
  assert.equal(study.label, 'ARCANIST_ATLAS_STUDY');
  assert.equal(study.referencePath, baseline.referencePath);
  assert.equal(study.sourcePresetId, baseline.sourcePresetId);
  assert.equal(study.referenceStyle.productionStage, 'BLOCKOUT');
  assert.equal(study.referenceStyle.modelingMode, 'runtime-procedural');
  assert.equal(study.referenceStyle.productionReady, false);
  assert.equal(study.referenceStyle.detailProfile, 'arcanist-atlas-v1');
  assert.ok(REVIEW_REFERENCE_MODELS.indexOf(study) > REVIEW_REFERENCE_MODELS.indexOf(baseline));
});
