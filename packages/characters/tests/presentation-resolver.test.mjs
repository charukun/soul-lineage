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

test('BLOCKOUT/reference candidates can never masquerade as production assets', () => {
  const context = { app: 'rinne', role: 'knight', ageBand: 'adult', renderTier: 'full' };
  assert.equal(selectCharacterProductionAsset([
    { id: 'runtime.knight', productionStage: 'BLOCKOUT', productionReady: true }
  ], context), null);

  const selected = selectCharacterProductionAsset([
    { id: 'adult.knight.v1', assetId: 'character.adult.knight.v1', productionStage: 'RUNTIME_READY', productionReady: true,
      apps: ['rinne'], roles: ['knight'], ageBands: ['adult'], renderTiers: ['full'] }
  ], context);
  assert.equal(selected.assetId, 'character.adult.knight.v1');
  assert.equal(selected.productionStage, 'RUNTIME_READY');
  assert.equal(selectCharacterProductionAsset([
    { id: 'adult.knight.v1', productionStage: 'RUNTIME_READY', productionReady: true, apps: ['demon'] }
  ], context), null);
});

test('resolver rejects unknown app, invalid distance and invalid role identifiers', () => {
  const c = make();
  assert.throws(() => resolveCharacterPresentation({ character: c, app: 'other' }));
  assert.throws(() => resolveCharacterPresentation({ character: c, app: 'rinne', distance: NaN }));
  assert.throws(() => resolveCharacterPresentation({ character: c, app: 'rinne', role: '../../bad' }));
});
