import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, YEAR_MS } from '../src/master-character.js';
import {
  characterPresentationAgeBand,
  resolveCharacterBodyArchetype,
  resolveCharacterPresentation,
  resolveCharacterPresentations,
  resolveCharacterRoleAppearance,
  selectCharacterProductionAsset
} from '../src/presentation-resolver.js';

const make = (id = 'hero', seed = 7, age = 20) => createCharacter({ id, seed, ageMs: age * YEAR_MS });

function readyManifest() {
  return {
    schema: 'character-production', version: 2, id: 'adult.knight.v1', stage: 'RUNTIME_READY', modelingMode: 'dcc-blender',
    source: {
      referencePaths: ['docs/characters/references/test/front.png'], meshPath: 'assets/characters/adult-knight.v1.vrm',
      dcc: { tool: 'Blender', version: '4.x', sourcePath: 'assets/characters/adult-knight.v1.blend' }
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
      runtime: { format: 'vrm', webgl2: true, assetHash: 'sha256:approved', provenanceReviewed: true, licenseReviewed: true, desktopP95Ms: 15, mobileP95Ms: 30, triangles: 48000, drawCalls: 18, textureMemoryBytes: 33554432, mobileDeviceClass: 'pixel-fold-class', reviewViewCount: 8 }
    }
  };
}

test('age and body archetype are deterministic presentation data, not saved state', () => {
  const child = make('child', 1, 7), adult = make('adult', 2, 18), elder = make('elder', 3, 65);
  assert.equal(characterPresentationAgeBand(child), 'child');
  assert.equal(characterPresentationAgeBand(adult), 'adult');
  assert.equal(characterPresentationAgeBand(elder), 'elder');
  const before = structuredClone(adult), body = resolveCharacterBodyArchetype(adult);
  assert.match(body.id, /^adult\.(balanced|slender|sturdy|compact)$/);
  assert.ok(body.heightMetres > 0);
  assert.deepEqual(adult, before);
});

test('role presentation changes clothing guidance while preserving explicit appearance choices', () => {
  const c = make('smith', 11, 30);
  const role = resolveCharacterRoleAppearance(c, { role: 'smith' });
  assert.equal(role.parts.outfit, 'apron');
  assert.equal(role.parts.accessory, 'headband');
  assert.equal(role.reference.id, 'blacksmith.reference.v1');
  assert.equal(role.reference.productionStage, 'BLOCKOUT');
  assert.equal(role.reference.productionReady, false);

  const overridden = resolveCharacterRoleAppearance(c, {
    role: 'smith', appearanceOverrides: { outfit: 'uniform', accessory: 'glasses' }
  });
  assert.equal(overridden.parts.outfit, 'uniform');
  assert.equal(overridden.parts.accessory, 'glasses');
});

test('same character keeps identity across all three app presentations', () => {
  const c = make('shared-human', 19, 24), before = structuredClone(c);
  const apps = ['rinne', 'village', 'demon'];
  const resolved = apps.map(app => resolveCharacterPresentation({ character: c, app, role: 'hunter', distance: 3 }));
  assert.deepEqual(resolved.map(row => row.characterId), apps.map(() => c.id));
  assert.ok(resolved.every(row => row.bodyArchetype.id === resolved[0].bodyArchetype.id));
  assert.ok(resolved.every(row => row.roleAppearance.parts.hair === resolved[0].roleAppearance.parts.hair));
  assert.deepEqual(c, before);
});

test('crowd resolution delegates full/mid/far/hidden policy to crowdPlan', () => {
  const actors = Array.from({ length: 10 }, (_, i) => ({
    character: make(`actor-${i}`, i, 20),
    distance: i === 9 ? 30 : i,
    visible: i !== 0,
    important: i === 1,
    role: 'villager'
  }));
  const rows = resolveCharacterPresentations(actors, { app: 'village' });
  assert.equal(rows.filter(row => row.render.tier === 'full').length, 6);
  assert.equal(rows.find(row => row.characterId === 'actor-0').render.tier, 'hidden');
  assert.equal(rows.find(row => row.characterId === 'actor-9').render.tier, 'far');
  assert.equal(rows.find(row => row.characterId === 'actor-9').render.animationHz, 5);
});

test('production selection fails closed without a complete RUNTIME_READY manifest', () => {
  const context = { app: 'rinne', role: 'knight', ageBand: 'adult', bodyArchetype: 'adult.sturdy', renderTier: 'full' };

  assert.equal(selectCharacterProductionAsset([
    { id: 'runtime.knight', productionStage: 'BLOCKOUT', productionReady: true }
  ], context), null);

  assert.equal(selectCharacterProductionAsset([
    { id: 'spoofed.ready', productionStage: 'RUNTIME_READY', productionReady: true }
  ], context), null);

  const pending = readyManifest();
  pending.evidence.polish.visualApproval = 'pending';
  assert.equal(selectCharacterProductionAsset([{ id: 'pending.knight', manifest: pending }], context), null);

  const selected = selectCharacterProductionAsset([{
    id: 'adult.knight.v1', assetId: 'character.adult.knight.v1', manifest: readyManifest(),
    apps: ['rinne'], roles: ['knight'], ageBands: ['adult'], bodyArchetypes: ['adult.sturdy'], renderTiers: ['full']
  }], context);
  assert.equal(selected.assetId, 'character.adult.knight.v1');
  assert.equal(selected.productionStage, 'RUNTIME_READY');

  assert.equal(selectCharacterProductionAsset([{
    id: 'wrong-app', manifest: readyManifest(), apps: ['demon']
  }], context), null);
  assert.equal(selectCharacterProductionAsset([{
    id: 'wrong-body', manifest: readyManifest(), bodyArchetypes: ['adult.slender']
  }], context), null);
});

test('resolver rejects unknown app, invalid distance and invalid role identifiers', () => {
  const c = make();
  assert.throws(() => resolveCharacterPresentation({ character: c, app: 'other' }));
  assert.throws(() => resolveCharacterPresentation({ character: c, app: 'rinne', distance: NaN }));
  assert.throws(() => resolveCharacterPresentation({ character: c, app: 'rinne', role: '../../bad' }));
});
