import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_REFERENCE_MODELS,
  RECONSTRUCTED_WAYFARER_MODEL_ID
} from '../src/reference-model-catalog.js';
import { validateVisualIdentity } from '../src/visual-identity.js';

test('reconstructed wayfarer is a selectable runtime rebuild with explicit CC0 provenance', () => {
  const model = CHARACTER_REFERENCE_MODELS[RECONSTRUCTED_WAYFARER_MODEL_ID];
  assert.ok(model);
  assert.equal(model.kind, 'runtime-reference-model');
  assert.equal(model.modelingMode, 'runtime-procedural-rebuild');
  assert.equal(model.productionReady, false);
  assert.doesNotThrow(() => validateVisualIdentity(model));

  assert.equal(model.sourceReference.source, 'KayKit Character Pack: Adventurers / Knight.glb');
  assert.equal(model.sourceReference.license, 'CC0-1.0');
  assert.equal(model.sourceReference.use, 'visual-form-seed-only');
  assert.equal(model.sourceReference.reusedGeometry, false);
  assert.equal(model.sourceReference.reusedTextures, false);
  assert.deepEqual(model.sourceReference.transformation, [
    'discard-source-mesh-and-materials',
    'rebuild-on-audited-humanoid-rig',
    'replace-topology-with-runtime-procedural-geometry',
    'replace-surface-with-new-stylized-material-palette',
    'restyle-armored-knight-as-itinerant-wayfarer'
  ]);

  assert.equal(model.referenceStyle.design, 'reconstructed-wayfarer');
  assert.equal(model.referenceStyle.topologyPreset, 'procedural-humanoid-rebuild-v1');
  assert.equal(model.referenceStyle.surfacePreset, 'new-flat-stylized-materials-v1');
  assert.equal(model.referenceStyle.armStyle, 'shirt');
  assert.equal(model.referenceStyle.legStyle, 'pants');
  assert.equal(model.referenceStyle.footwear, 'boots');
  assert.equal(model.referenceStyle.prop, 'satchel');
});
