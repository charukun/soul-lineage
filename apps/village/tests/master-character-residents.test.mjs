import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MASTER_RESIDENT_RENDERER_STATE,
  MASTER_RESIDENT_REPLACEMENT
} from '../src/mura-master-characters.js';
import { VILLAGE_CHARACTER_RUNTIME } from '../src/character-runtime-adapter.js';

test('village human residents use the shared KayKit runtime family', () => {
  assert.equal(MASTER_RESIDENT_RENDERER_STATE, 'shared-kaykit-runtime');
  assert.equal(MASTER_RESIDENT_REPLACEMENT, 'kaykit.adventurers.v1');
  assert.equal(VILLAGE_CHARACTER_RUNTIME.family, 'kaykit.adventurers.v1');
  assert.equal(VILLAGE_CHARACTER_RUNTIME.rigFamily, 'Rig_Medium');
  assert.equal(VILLAGE_CHARACTER_RUNTIME.format, 'glb');
});

test('resident integration loads real KayKit models and keeps procedural rendering fallback-only', () => {
  const source = readFileSync(new URL('../src/character-runtime-integration.js', import.meta.url), 'utf8');
  assert.match(source, /loadKaykitRuntimeModel/);
  assert.match(source, /createCharacterProductionPool/);
  assert.match(source, /characterRuntimeModel='kaykit'/);
  assert.match(source, /manifestationSource='kaykit-model'/);
  assert.match(source, /procedural-fallback/);
  assert.doesNotMatch(source, /SHINO_review|humanoid\.shino|Sendagaya_Shino/);
});
