import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CHARACTER_RUNTIME_STATE_IDS,
  CHARACTER_RUNTIME_STATES,
  KAYKIT_MODEL_BY_KEY,
  createCharacterRuntimeAdapter,
  resolveCharacterRuntimeState
} from '@soul/characters';
import { RINNE_CHARACTER_RUNTIME, resolveRinneCharacterRuntime } from '../apps/rinne/src/rebuild/character-runtime-adapter.js';
import { VILLAGE_CHARACTER_RUNTIME, resolveVillageCharacterRuntime } from '../apps/village/src/character-runtime-adapter.js';
import { DEMON_CHARACTER_RUNTIME, resolveDemonCharacterRuntime } from '../apps/demon/src/character-runtime-adapter.js';

const EXPECTED_STATES = ['idle', 'walk', 'run', 'dash', 'rest', 'combat-idle', 'attack', 'hit', 'death'];

test('shared runtime state priority is stable', () => {
  assert.deepEqual(CHARACTER_RUNTIME_STATE_IDS, EXPECTED_STATES);
  assert.equal(resolveCharacterRuntimeState({ moving: true, speed: 2 }), CHARACTER_RUNTIME_STATES.WALK);
  assert.equal(resolveCharacterRuntimeState({ moving: true, speed: 5 }), CHARACTER_RUNTIME_STATES.RUN);
  assert.equal(resolveCharacterRuntimeState({ dashing: true, moving: true, speed: 8 }), CHARACTER_RUNTIME_STATES.DASH);
  assert.equal(resolveCharacterRuntimeState({ resting: true, combat: true }), CHARACTER_RUNTIME_STATES.REST);
  assert.equal(resolveCharacterRuntimeState({ combat: true }), CHARACTER_RUNTIME_STATES.COMBAT_IDLE);
  assert.equal(resolveCharacterRuntimeState({ attacking: true, combat: true }), CHARACTER_RUNTIME_STATES.ATTACK);
  assert.equal(resolveCharacterRuntimeState({ hit: true, attacking: true }), CHARACTER_RUNTIME_STATES.HIT);
  assert.equal(resolveCharacterRuntimeState({ dead: true, hit: true }), CHARACTER_RUNTIME_STATES.DEATH);
});

test('three apps keep current visual foundations behind one adapter schema', () => {
  for (const adapter of [RINNE_CHARACTER_RUNTIME, VILLAGE_CHARACTER_RUNTIME, DEMON_CHARACTER_RUNTIME]) {
    assert.equal(adapter.schema, 'soul.character-runtime-adapter');
    assert.equal(adapter.version, 1);
    assert.equal(adapter.geometry.origin, 'feet');
    assert.equal(adapter.geometry.sockets.weapon, 'rightHand');
    assert.equal(adapter.geometry.sockets.offhand, 'leftHand');
    assert.equal(adapter.geometry.collider.shape, 'capsule');
  }
  assert.equal(RINNE_CHARACTER_RUNTIME.family, 'kaykit.adventurers.v1');
  assert.equal(RINNE_CHARACTER_RUNTIME.format, 'glb');
  assert.equal(RINNE_CHARACTER_RUNTIME.rigFamily, 'Rig_Medium');

  assert.equal(VILLAGE_CHARACTER_RUNTIME.family, 'village.procedural-resident.v1');
  assert.equal(VILLAGE_CHARACTER_RUNTIME.format, 'procedural');
  assert.equal(VILLAGE_CHARACTER_RUNTIME.asset.id, 'procedural-resident-presentation');
  assert.equal(VILLAGE_CHARACTER_RUNTIME.asset.url, null);

  assert.equal(DEMON_CHARACTER_RUNTIME.family, 'kaykit.adventurers.v1');
  assert.equal(DEMON_CHARACTER_RUNTIME.format, 'glb');
  assert.equal(DEMON_CHARACTER_RUNTIME.rigFamily, 'Rig_Medium');
  assert.equal(DEMON_CHARACTER_RUNTIME.asset.id, KAYKIT_MODEL_BY_KEY.knight.id);
});

test('app adapters resolve common semantic states without sharing model implementation', () => {
  assert.equal(resolveRinneCharacterRuntime({ dashing: true, moving: true, speed: 8 }).state, 'dash');
  assert.equal(resolveRinneCharacterRuntime({ combat: true }).state, 'combat-idle');
  assert.equal(resolveVillageCharacterRuntime({ resting: true }).state, 'rest');
  assert.equal(resolveVillageCharacterRuntime({ task: 'defending' }).state, 'combat-idle');
  assert.equal(resolveVillageCharacterRuntime({ moving: true, speed: 4 }).state, 'run');
  assert.equal(resolveDemonCharacterRuntime({ combat: true }).state, 'combat-idle');
  assert.equal(resolveDemonCharacterRuntime({ attacking: true, combat: true }).state, 'attack');
  assert.equal(resolveDemonCharacterRuntime({ dead: true }).state, 'death');
});

test('missing app-specific motions fall back through the shared contract', () => {
  const adapter = createCharacterRuntimeAdapter({
    id: 'test.runtime',
    family: 'test.family',
    rigFamily: 'test.rig',
    format: 'glb',
    asset: { id: 'test.glb' },
    motion: { idle: 'idle-clip', walk: 'walk-clip', run: 'run-clip' }
  });
  assert.deepEqual(adapter.resolveMotion('dash'), {
    requestedState: 'dash', resolvedState: 'run', route: 'run-clip', fallback: true
  });
  assert.deepEqual(adapter.resolveMotion('attack'), {
    requestedState: 'attack', resolvedState: 'idle', route: 'idle-clip', fallback: true
  });
});

test('new runtime adapters do not restore retired conditional character asset routes', async () => {
  const files = [
    'apps/rinne/src/rebuild/character-runtime-adapter.js',
    'apps/village/src/character-runtime-adapter.js',
    'apps/village/src/character-runtime-integration.js',
    'apps/demon/src/character-runtime-adapter.js'
  ];
  const source = (await Promise.all(files.map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')))).join('\n');
  assert.equal(source.includes('SHINO_review.vrm'), false);
  assert.equal(source.includes('PROTAGONIST_VILLAGER_V1.glb'), false);
});
