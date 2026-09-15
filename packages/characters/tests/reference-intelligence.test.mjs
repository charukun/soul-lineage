import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCharacterCoverageMatrix,
  compareCharacterRuntimeToGolden,
  createCharacterGoldenBaseline,
  defaultCharacterCoverageTargets,
  defineExternalCharacterReference,
  evaluateExternalReferenceConsensus,
  getExternalCharacterReference,
  validateCharacterGoldenBaseline
} from '../src/reference-intelligence.js';
import {
  REQUIRED_DEFORMATION_POSES,
  REQUIRED_MOTION_CLIPS,
  REQUIRED_MOTION_PRINCIPLES,
  REQUIRED_POLISH_EXPRESSIONS
} from '../src/production-pipeline.js';

const target = Object.freeze({
  app: 'village', ageBand: 'adult', bodyArchetype: 'adult.sturdy', role: 'guard', renderTier: 'full'
});

function blockoutManifest() {
  return {
    schema: 'character-production', version: 2, id: 'guard.blockout.v1', stage: 'BLOCKOUT', modelingMode: 'runtime-procedural',
    source: { referencePaths: ['docs/characters/references/guard.png'] },
    evidence: {
      reference: { intentLocked: true, views: ['front', 'side', 'back'] },
      blockout: { views: ['front', 'side', 'back', 'three-quarter'], proportionsReviewed: true, silhouetteReviewed: true }
    }
  };
}

function runtimeReadyManifest() {
  return {
    schema: 'character-production', version: 2, id: 'character.guard.golden.v1', stage: 'RUNTIME_READY', modelingMode: 'dcc-blender',
    source: {
      referencePaths: ['docs/characters/references/guard.png'],
      meshPath: 'assets/characters/guard.vrm',
      dcc: { tool: 'Blender', version: '4.5', sourcePath: 'assets/characters/guard.blend' }
    },
    evidence: {
      reference: { intentLocked: true, views: ['front', 'side', 'back'] },
      blockout: { views: ['front', 'side', 'back', 'three-quarter'], proportionsReviewed: true, silhouetteReviewed: true },
      primary: { topologyReviewed: true, uvReviewed: true, separateSurfaces: ['skin', 'hair', 'clothing'] },
      secondary: { hairFormsReviewed: true, clothingFormsReviewed: true, accessoriesReviewed: true },
      deformation: {
        poses: [...REQUIRED_DEFORMATION_POSES], weightsReviewed: true,
        selfIntersectionReviewed: true, clothingHairCollisionReviewed: true
      },
      motion: {
        clips: [...REQUIRED_MOTION_CLIPS], viewCount: 8, returnsToStablePose: true,
        principles: Object.fromEntries(REQUIRED_MOTION_PRINCIPLES.map(key => [key, true]))
      },
      polish: {
        expressions: [...REQUIRED_POLISH_EXPRESSIONS],
        materials: { baseColor: true, roughness: true, metallic: true, normal: true },
        secondaryMotionReviewed: true, visualApproval: 'approved'
      },
      runtime: {
        format: 'vrm', webgl2: true, assetHash: 'a'.repeat(64), provenanceReviewed: true, licenseReviewed: true,
        desktopP95Ms: 12, mobileP95Ms: 28, triangles: 30000, drawCalls: 10,
        textureMemoryBytes: 50_000_000, mobileDeviceClass: 'pixel-fold-class', reviewViewCount: 8
      }
    }
  };
}

const presentation = Object.freeze({
  apps: ['village'], ageBands: ['adult'], bodyArchetypes: ['adult.sturdy'], roles: ['guard'], renderTiers: ['full']
});

test('external references are pinned, verified and consensus counts independent provenance families', () => {
  const source = getExternalCharacterReference('sendagaya-shino-yui');
  assert.match(source.revision, /^[0-9a-f]{40}$/);
  assert.match(source.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(source.copyPolicy, 'never-wholesale-copy');
  assert.equal(source.sourceFamily, 'vroid-project');
  assert.ok(source.evidence.includes('resources/vrms/Sendagaya_Shino.PROVENANCE.md'));

  const sameFamily = evaluateExternalReferenceConsensus(
    ['sendagaya-shino-yui', 'vroid-sample-a-voxavatar', 'vroid-sample-b-voxavatar'], 'vrm-humanoid'
  );
  assert.equal(sameFamily.status, 'insufficient');
  assert.equal(sameFamily.independentSourceCount, 1);

  const independent = evaluateExternalReferenceConsensus(
    ['sendagaya-shino-yui', 'vroid-sample-a-voxavatar', 'pixiv-three-vrm-runtime'], 'vrm-humanoid'
  );
  assert.equal(independent.status, 'consensus');
  assert.equal(independent.independentSourceCount, 2);
});

test('unversioned, unlicensed or ambiguous public references are rejected', () => {
  const base = {
    id: 'bad.reference', kind: 'character-reference', repository: 'https://github.com/example/repo',
    revision: 'a'.repeat(40), sourceFamily: 'example-family', license: 'MIT', adoptionPolicy: 'reference-only',
    evidence: ['README.md'], observations: ['stylized-humanoid'], verifiedOn: '2026-09-15'
  };
  assert.throws(() => defineExternalCharacterReference({ ...base, revision: 'main' }));
  assert.throws(() => defineExternalCharacterReference({ ...base, license: 'unknown' }));
  assert.throws(() => defineExternalCharacterReference({ ...base, evidence: ['../escape.glb'] }));
  assert.throws(() => defineExternalCharacterReference({ ...base, sourceFamily: '' }));
  assert.throws(() => defineExternalCharacterReference({ ...base, verifiedOn: 'today' }));
});

test('default coverage uses latest archetype app contexts and links Shino source evidence', () => {
  const rows = defaultCharacterCoverageTargets({ renderTiers: ['full'] });
  assert.ok(rows.some(row => row.app === 'village' && row.role === 'guard' && row.bodyArchetype === 'adult.sturdy'));
  assert.ok(rows.some(row => row.app === 'demon' && row.role === 'guard' && row.bodyArchetype === 'adult.sturdy'));
  assert.ok(!rows.some(row => row.app === 'rinne' && row.role === 'guard'));
  const shino = rows.find(row => row.app === 'rinne' && row.role === 'traveller');
  assert.ok(shino);
  assert.deepEqual(shino.externalReferenceIds, ['sendagaya-shino-yui']);
});

test('coverage requires explicit presentation selectors and never promotes BLOCKOUT', () => {
  const manifest = blockoutManifest();
  const withoutSelector = buildCharacterCoverageMatrix([target], { productionAssets: [manifest] });
  assert.equal(withoutSelector.rows[0].status, 'reference-only');

  const withSelector = buildCharacterCoverageMatrix([target], { productionAssets: [{ manifest, presentation }] });
  assert.equal(withSelector.rows[0].status, 'in-production');
  assert.equal(withSelector.rows[0].production[0].stage, 'BLOCKOUT');
  assert.equal(withSelector.rows[0].production[0].productionReady, false);
  assert.equal(withSelector.rows[0].nextAction, 'advance-production-stage');
});

test('golden baselines require RUNTIME_READY plus visual approval and matching production evidence', () => {
  assert.throws(() => createCharacterGoldenBaseline({ id: 'guard.golden', target, manifest: blockoutManifest() }));
  const manifest = runtimeReadyManifest();
  const golden = createCharacterGoldenBaseline({ id: 'guard.golden', target, manifest });
  assert.equal(golden.productionStage, 'RUNTIME_READY');
  assert.equal(golden.visualApproval, 'approved');
  assert.equal(golden.metrics.triangles, 30000);

  const unbacked = buildCharacterCoverageMatrix([target], { goldenBaselines: [golden] });
  assert.equal(unbacked.rows[0].status, 'reference-only');
  assert.equal(unbacked.rows[0].golden.length, 0);

  const matrix = buildCharacterCoverageMatrix([target], {
    productionAssets: [{ manifest, presentation }], goldenBaselines: [golden]
  });
  assert.equal(matrix.rows[0].status, 'golden');
  assert.equal(matrix.rows[0].nextAction, 'monitor');
});

test('hand-authored invalid golden evidence fails closed', () => {
  const valid = createCharacterGoldenBaseline({ id: 'guard.golden', target, manifest: runtimeReadyManifest() });
  assert.throws(() => validateCharacterGoldenBaseline({ ...valid, visualApproval: 'pending' }));
  assert.throws(() => validateCharacterGoldenBaseline({ ...valid, metrics: { ...valid.metrics, triangles: -1 } }));
  assert.throws(() => buildCharacterCoverageMatrix([target], { goldenBaselines: [{ ...valid, productionStage: 'PRIMARY' }] }));
});

test('golden comparison stays diagnostic and cannot grant visual approval', () => {
  const golden = createCharacterGoldenBaseline({ id: 'guard.golden', target, manifest: runtimeReadyManifest() });
  const comparison = compareCharacterRuntimeToGolden({
    triangles: 33000, drawCalls: 9, textureMemoryBytes: 48_000_000, desktopP95Ms: 13, mobileP95Ms: 30
  }, golden);
  assert.equal(comparison.result, 'complete');
  assert.equal(comparison.visualApprovalRequired, true);
  assert.equal(comparison.comparisons.find(row => row.metric === 'triangles').delta, 3000);
  assert.equal(comparison.comparisons.find(row => row.metric === 'drawCalls').delta, -1);
});
