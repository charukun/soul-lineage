import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_REFERENCE_MODELS } from '../src/reference-models.js';
import { referenceModelProductionStage } from '../src/production-pipeline.js';

test('reference catalog cannot hide production stage', () => {
  for (const [id, model] of Object.entries(CHARACTER_REFERENCE_MODELS)) {
    const implied = referenceModelProductionStage(model);
    assert.ok(model.productionStage, `${id} must declare productionStage`);
    assert.equal(model.productionStage, implied, `${id} must use honest stage ${implied}`);
    assert.ok(model.modelingMode, `${id} must declare modelingMode`);
    if (model.kind === 'runtime-reference-model') {
      assert.equal(model.productionStage, 'BLOCKOUT');
      assert.equal(model.modelingMode, 'runtime-procedural');
      assert.notEqual(model.productionReady, true);
    }
  }
});
