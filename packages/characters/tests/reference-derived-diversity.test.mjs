import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, YEAR_MS } from '../src/master-character.js';
import { visualIdentityForCharacter } from '../src/visual-identity.js';

test('free generation includes reference-derived bun hair and child ribbon variation', () => {
  let buns = 0, ribbons = 0, plainChildren = 0;
  for (let seed = 0; seed < 160; seed++) {
    const adult = createCharacter({ id: `ref-diversity.adult.${seed}`, seed, ageMs: 22 * YEAR_MS });
    if (visualIdentityForCharacter(adult).parts.hair === 'bun') buns++;
    const child = createCharacter({ id: `ref-diversity.child.${seed}`, seed, ageMs: 7 * YEAR_MS });
    const childIdentity = visualIdentityForCharacter(child);
    if (childIdentity.parts.accessory === 'ribbon') ribbons++;
    if (childIdentity.parts.accessory === 'none') plainChildren++;
  }
  assert.ok(buns > 0);
  assert.ok(ribbons > 0);
  assert.ok(plainChildren > 0);
});
