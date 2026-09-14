import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, serializeCharacter, YEAR_MS } from '../src/master-character.js';
import { BASE_APPEARANCE_PARTS } from '../src/appearance-parts.js';
import { visualIdentityForCharacter, compareVisualIdentities } from '../src/visual-identity.js';

const record = seed => createCharacter({ id: `hair-qc.${seed}`, seed, ageMs: 22 * YEAR_MS });

test('short crops never advertise an unused tied-back channel and remain reproducible', () => {
  let crops = 0;
  for (let seed = 0; seed < 240; seed++) {
    const c = record(seed), before = serializeCharacter(c), first = visualIdentityForCharacter(c);
    if (first.parts.hair === 'crop') { crops++; assert.notEqual(first.back, 'tied'); }
    assert.deepEqual(first, visualIdentityForCharacter(c));
    assert.equal(serializeCharacter(c), before);
  }
  assert.ok(crops > 0);
});

test('QC counts identical crop geometry only once, including earlier derived identities', () => {
  const c = record(42);
  const identity = visualIdentityForCharacter(c, { parts: { ...BASE_APPEARANCE_PARTS, hair: 'crop' } });
  const report = compareVisualIdentities([
    { id: 'close', identity: { ...identity, back: 'close' } },
    { id: 'tied', identity: { ...identity, back: 'tied' } }
  ]);
  assert.equal(report.hairstyles, 1);
  assert.equal(report.silhouettes, 1);
  assert.deepEqual(report.similar, [['close', 'tied']]);
  assert.equal(report.visualApproval, 'requires-rendered-review');
});

test('source hair ignores hidden procedural front/back settings in quality counts', () => {
  const identity = visualIdentityForCharacter(record(7), { parts: BASE_APPEARANCE_PARTS });
  const report = compareVisualIdentities([
    { id: 'a', identity: { ...identity, front: 'parted', back: 'close' } },
    { id: 'b', identity: { ...identity, front: 'fringe', back: 'tied' } }
  ]);
  assert.equal(report.hairstyles, 1);
  assert.equal(report.silhouettes, 1);
  assert.deepEqual(report.similar, [['a', 'b']]);
});
