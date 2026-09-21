import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_REFERENCE_MODELS } from '../src/index.js';

const PROCEDURAL_REFERENCE_IDS = [
  'child-boy.reference.v1',
  'child-girl.reference.v1',
  'elderly-man.reference.v1',
  'elderly-woman.reference.v1',
  'guard.reference.v1',
  'knight.reference.v1',
  'blacksmith.reference.v1',
  'laborer.reference.v1',
  'hunter.reference.v1',
  'arcanist.reference.v1'
];

test('active character catalog exposes committed models only, never reference-sheet procedural blockouts', () => {
  assert.equal(Object.hasOwn(CHARACTER_REFERENCE_MODELS, 'protagonist.villager.v1'), true);
  assert.equal(Object.hasOwn(CHARACTER_REFERENCE_MODELS, 'protagonist.villager.female.v1'), true);
  for (const id of PROCEDURAL_REFERENCE_IDS) {
    assert.equal(Object.hasOwn(CHARACTER_REFERENCE_MODELS, id), false, id);
  }
  assert.ok(Object.values(CHARACTER_REFERENCE_MODELS).every(model => model.kind !== 'runtime-reference-model'));
});
