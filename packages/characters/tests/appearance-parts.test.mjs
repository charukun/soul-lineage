import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../src/master-character.js';
import {
  APPEARANCE_PARTS, BASE_APPEARANCE_PARTS, appearancePartsForCharacter,
  appearancePartsForSeed, mergeAppearanceParts, nextAppearanceParts, validateAppearanceParts
} from '../src/appearance-parts.js';

test('appearance parts are deterministic and validated', () => {
  const a = appearancePartsForSeed(1234);
  const b = appearancePartsForSeed(1234);
  assert.deepEqual(a, b);
  validateAppearanceParts(a);
  for (const [slot, rows] of Object.entries(APPEARANCE_PARTS)) assert.ok(rows.some(row => row.id === a[slot]));
});

test('appearance generation yields visibly useful slot diversity across a production cohort', () => {
  const rows = Array.from({ length: 30 }, (_, i) => appearancePartsForSeed(1000 + i));
  const signatures = new Set(rows.map(row => [row.face, row.hair, row.body, row.outfit, row.accessory].join('|')));
  assert.ok(signatures.size >= 20, `expected >=20 combinations, received ${signatures.size}`);
  for (const slot of Object.keys(APPEARANCE_PARTS)) assert.ok(new Set(rows.map(row => row[slot])).size >= 3, `${slot} did not vary enough`);
});

test('character style can be regenerated or overridden without changing canonical character data', () => {
  const character = createCharacter({ id: 'review.parts.1', seed: 77 });
  const generated = appearancePartsForCharacter(character);
  assert.deepEqual(generated, appearancePartsForCharacter(character));
  const manual = mergeAppearanceParts(BASE_APPEARANCE_PARTS, { hair: 'bob', outfit: 'mantle', accessory: 'glasses' });
  assert.equal(manual.hair, 'bob');
  assert.equal(manual.outfit, 'mantle');
  assert.equal(manual.accessory, 'glasses');
  assert.notDeepEqual(nextAppearanceParts(character, 1), nextAppearanceParts(character, 2));
  assert.equal(character.revision, 0);
});

test('invalid appearance slots fail closed', () => {
  assert.throws(() => mergeAppearanceParts(BASE_APPEARANCE_PARTS, { hair: 'unknown' }), /Invalid appearance part hair/);
  assert.throws(() => mergeAppearanceParts(BASE_APPEARANCE_PARTS, { surprise: 'x' }), /Unknown appearance slot/);
});
