import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPEARANCE_PARTS, CHARACTER_REFERENCE_ARCHETYPES, YEAR_MS,
  characterReferenceArchetype, createCharacter, visualIdentityForReferenceArchetype
} from '../src/index.js';

const record = (id, seed, age) => createCharacter({ id, seed, ageMs: age * YEAR_MS });

test('NPC reference archetype catalog exposes ten distinct review targets with bounded coverage', () => {
  const rows = Object.values(CHARACTER_REFERENCE_ARCHETYPES);
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map(row => row.assetFile)).size, 10);
  assert.equal(new Set(rows.map(row => row.repositoryPath)).size, 10);
  for (const row of rows) {
    assert.equal(row.version, 1);
    assert.ok(row.repositoryPath.endsWith(`/npc-role-set/${row.assetFile}`));
    assert.ok(Array.isArray(row.coverage.implementedModularParts));
    assert.ok(Array.isArray(row.coverage.proposedParts));
    assert.ok(Array.isArray(row.coverage.gameEquipment));
    assert.ok(APPEARANCE_PARTS.hair.some(part => part.id === row.profile.hair));
    assert.ok(APPEARANCE_PARTS.accessory.some(part => part.id === row.profile.accessory));
  }
});

test('child girl target uses implemented bun and ribbon while keeping age-derived child identity', () => {
  const c = record('ref.child.girl', 41, 7);
  const identity = visualIdentityForReferenceArchetype(c, 'npc.child-girl.v1');
  assert.equal(identity.role, 'child');
  assert.equal(identity.ageBand, 'child');
  assert.equal(identity.parts.hair, 'bun');
  assert.equal(identity.parts.accessory, 'ribbon');
  assert.equal(identity.front, 'swept');
  assert.equal(identity.back, 'tied');
  assert.equal(identity.referenceArchetypeId, 'npc.child-girl.v1');
  assert.deepEqual(identity, visualIdentityForReferenceArchetype(c, 'npc.child-girl.v1'));
});

test('elder target preserves age-derived elder role while using only implemented profile slots', () => {
  const c = record('ref.elder.woman', 77, 75);
  const identity = visualIdentityForReferenceArchetype(c, 'npc.elderly-woman.v1');
  assert.equal(identity.role, 'elder');
  assert.equal(identity.ageBand, 'elder');
  assert.equal(identity.parts.hair, 'bun');
  assert.equal(identity.parts.outfit, 'mantle');
  assert.equal(identity.gear, 'shawl');
});

test('reference archetype lookup fails closed', () => {
  assert.equal(characterReferenceArchetype('npc.guard.v1').role, 'guard');
  assert.throws(() => characterReferenceArchetype('npc.missing.v1'), /Unknown character reference archetype/);
});
