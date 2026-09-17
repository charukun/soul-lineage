import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_REFERENCE_MODELS as ACTIVE_REFERENCE_MODELS } from '../src/index.js';
import {
  CHARACTER_REFERENCE_MODELS,
  RECONSTRUCTED_WAYFARER_MODEL_ID
} from '../src/reference-model-catalog.js';
import { validateVisualIdentity } from '../src/visual-identity.js';

test('reconstructed wayfarer is a selectable Meshy-seeded runtime rebuild with explicit CC0 provenance', () => {
  const model = CHARACTER_REFERENCE_MODELS[RECONSTRUCTED_WAYFARER_MODEL_ID];
  const active = ACTIVE_REFERENCE_MODELS[RECONSTRUCTED_WAYFARER_MODEL_ID];
  assert.ok(model);
  assert.ok(active, 'Visual Review selector consumes the active reference-model catalog');
  assert.equal(active.id, RECONSTRUCTED_WAYFARER_MODEL_ID);
  assert.equal(model.kind, 'runtime-reference-model');
  assert.equal(model.modelingMode, 'runtime-procedural');
  assert.equal(model.productionStage, 'BLOCKOUT');
  assert.equal(model.productionReady, false);
  assert.doesNotThrow(() => validateVisualIdentity(model));

  assert.equal(model.version, 1);
  assert.equal(model.label, '再構築 Wayfarer / Meshy CC0 Seed');
  assert.equal(model.sourceReference.provider, 'Meshy');
  assert.equal(model.sourceReference.author, 'ktmarine1999');
  assert.equal(model.sourceReference.modelId, '0196ad16-605f-735d-9d1c-ec04032a2e02');
  assert.match(model.sourceReference.url, /^https:\/\/www\.meshy\.ai\/3d-models\//);
  assert.equal(model.sourceReference.license, 'CC0');
  assert.equal(model.sourceReference.use, 'public-preview-visual-form-seed-only');
  assert.equal(model.sourceReference.reusedGeometry, false);
  assert.equal(model.sourceReference.reusedTextures, false);
  assert.deepEqual(model.sourceReference.transformation, [
    'observe-public-preview-and-prompt-only',
    'discard-source-geometry-and-textures',
    'rebuild-topology-on-audited-humanoid-rig',
    'redesign-proportions-and-silhouette-for-rinne',
    'replace-surface-with-rinne-stylized-material-palette',
    'reinterpret-chibi-adventurer-as-rinne-wayfarer'
  ]);

  assert.equal(model.referenceStyle.design, 'meshy-seed-rinne-wayfarer');
  assert.equal(model.referenceStyle.topologyPreset, 'procedural-humanoid-rebuild-v2-meshy-visual-seed');
  assert.equal(model.referenceStyle.surfacePreset, 'rinne-flat-cloth-leather-v2');
  assert.deepEqual(model.referenceStyle.designDna, [
    'compact-chibi-proportions',
    'short-green-hood',
    'layered-leather-tunic',
    'short-dark-skirt',
    'simple-utility-belt',
    'tousled-brown-hair',
    'bright-blue-eyes',
    'leather-boots'
  ]);
  assert.equal(model.referenceStyle.armStyle, 'shirt');
  assert.equal(model.referenceStyle.legStyle, 'bare');
  assert.equal(model.referenceStyle.footwear, 'boots');
  assert.equal(model.referenceStyle.prop, 'satchel');
});
