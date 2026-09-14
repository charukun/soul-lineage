import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_PRODUCTION_STAGES,
  evaluateCharacterProduction,
  assertCharacterProductionStage,
  maximumStageForModelingMode,
  referenceModelProductionStage
} from '../src/production-pipeline.js';

function readyManifest(overrides = {}) {
  const manifest = {
    schema: 'character-production', version: 2, id: 'test.hero.v1', stage: 'RUNTIME_READY', modelingMode: 'dcc-blender',
    source: {
      referencePaths: ['docs/characters/references/test/front.png'], meshPath: 'assets/characters/test.glb',
      dcc: { tool: 'Blender', version: '4.x', sourcePath: 'art/characters/test.blend' }
    },
    evidence: {
      reference: { intentLocked: true, views: ['front','side','back'] },
      blockout: { views: ['front','side','back','three-quarter'], proportionsReviewed: true, silhouetteReviewed: true },
      primary: { topologyReviewed: true, uvReviewed: true, separateSurfaces: ['skin','hair','clothing'] },
      secondary: { hairFormsReviewed: true, clothingFormsReviewed: true, accessoriesReviewed: true },
      deformation: { poses: ['neutral','head-turn','arm-raise','elbow-bend','knee-bend','crouch'], weightsReviewed: true, selfIntersectionReviewed: true, clothingHairCollisionReviewed: true },
      motion: {
        clips: ['relaxed-idle','combat-idle','relaxed-to-combat','walk','run','attack','hit-small','hit-large','weapon-draw','weapon-sheathe'],
        viewCount: 8, returnsToStablePose: true,
        principles: { centerOfGravity: true, silhouette: true, lineOfAction: true, anticipation: true, timingSpacing: true, gameplayExaggeration: true, cameraVersatility: true }
      },
      polish: { expressions: ['neutral','blink','smile','mouth-open'], materials: { baseColor: true, roughness: true, metallic: true, normal: true }, secondaryMotionReviewed: true, visualApproval: 'approved' },
      runtime: { format: 'vrm', webgl2: true, assetHash: 'sha256:abc', provenanceReviewed: true, licenseReviewed: true, desktopP95Ms: 15.5, mobileP95Ms: 31.2, triangles: 48000, drawCalls: 18, textureMemoryBytes: 33554432, mobileDeviceClass: 'pixel-fold-class', reviewViewCount: 8 }
    }
  };
  return { ...manifest, ...overrides, source: { ...manifest.source, ...(overrides.source || {}) }, evidence: { ...manifest.evidence, ...(overrides.evidence || {}) } };
}

test('pipeline order is explicit and ends at runtime ready', () => {
  assert.deepEqual(CHARACTER_PRODUCTION_STAGES, ['REFERENCE','BLOCKOUT','PRIMARY','SECONDARY','DEFORMATION','MOTION','POLISH','RUNTIME_READY']);
});

test('runtime procedural geometry is blockout-only', () => {
  const manifest = readyManifest({ stage: 'BLOCKOUT', modelingMode: 'runtime-procedural' });
  const result = evaluateCharacterProduction(manifest, 'BLOCKOUT');
  assert.equal(result.ok, true);
  assert.equal(result.maximumStage, 'BLOCKOUT');
  const primary = evaluateCharacterProduction(manifest, 'PRIMARY');
  assert.equal(primary.ok, false);
  assert.match(primary.missing.join('\n'), /blockout-only|cannot advance beyond BLOCKOUT/);
});

test('reference-only content cannot be mislabelled as a model', () => {
  assert.equal(maximumStageForModelingMode('reference-only'), 'REFERENCE');
  const manifest = readyManifest({ stage: 'REFERENCE', modelingMode: 'reference-only' });
  assert.equal(evaluateCharacterProduction(manifest, 'BLOCKOUT').ok, false);
});

test('complete Blender/DCC evidence can reach runtime ready', () => {
  const result = assertCharacterProductionStage(readyManifest(), 'RUNTIME_READY');
  assert.equal(result.productionReady, true);
  assert.equal(result.highestEligibleStage, 'RUNTIME_READY');
});

test('motion gate requires game-facing pose and animation principles', () => {
  const manifest = readyManifest({
    stage: 'MOTION',
    evidence: { motion: { ...readyManifest().evidence.motion, principles: { ...readyManifest().evidence.motion.principles, anticipation: false } } }
  });
  const result = evaluateCharacterProduction(manifest, 'MOTION');
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes('evidence.motion.principles.anticipation'));
});

test('runtime ready enforces desktop and Pixel Fold-class budgets', () => {
  const manifest = readyManifest({ evidence: { runtime: { ...readyManifest().evidence.runtime, mobileP95Ms: 40, mobileDeviceClass: 'desktop-only' } } });
  const result = evaluateCharacterProduction(manifest, 'RUNTIME_READY');
  assert.equal(result.ok, false);
  assert.match(result.missing.join('\n'), /mobileP95Ms <= 33.34/);
  assert.match(result.missing.join('\n'), /pixel-fold-class/);
});

test('reference catalog kind implies honest production stage', () => {
  assert.equal(referenceModelProductionStage({ kind: 'reference-preset' }), 'REFERENCE');
  assert.equal(referenceModelProductionStage({ kind: 'runtime-reference-model', assetId: 'runtime.guard' }), 'BLOCKOUT');
  assert.equal(referenceModelProductionStage({ productionStage: 'POLISH' }), 'POLISH');
  assert.equal(referenceModelProductionStage(null), null);
});
