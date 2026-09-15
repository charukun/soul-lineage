import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspirationCatalogRevision,
  INSPIRATION_WEAPON_ARTS,
  INSPIRATION_WEAPONS,
  INSPIRATION_MOTION_IDS,
  getInspirationWeaponArts,
  cloneInspirationWeaponArts,
} from '../src/inspiration-catalog.js';

test('shared inspiration catalog owns every current weapon family', () => {
  assert.equal(inspirationCatalogRevision, 'inspiration-catalog-1');
  assert.deepEqual(INSPIRATION_WEAPONS, ['sword', 'great', 'spear', 'axe', 'fist', 'katana']);
  for (const weapon of INSPIRATION_WEAPONS) {
    const arts = getInspirationWeaponArts(weapon);
    assert.equal(typeof arts.tag, 'string');
    assert.ok(arts.tag.length > 0);
    assert.equal(typeof arts.desc, 'string');
    assert.ok(arts.desc.length > 0);
    for (const phase of ['open', 'middle', 'finish']) {
      assert.ok(Array.isArray(arts[phase]));
      assert.ok(arts[phase].length > 0);
      assert.ok(arts[phase].every(id => typeof id === 'string' && id.length > 0));
    }
  }
});

test('catalog retains representative discoveries beyond a Tidebreak demo subset', () => {
  assert.ok(INSPIRATION_WEAPON_ARTS.sword.middle.includes('crosscut'));
  assert.ok(INSPIRATION_WEAPON_ARTS.sword.finish.includes('dash'));
  assert.ok(INSPIRATION_WEAPON_ARTS.great.open.includes('pommel'));
  assert.ok(INSPIRATION_WEAPON_ARTS.great.finish.includes('leap'));
  assert.ok(INSPIRATION_WEAPON_ARTS.spear.middle.includes('spearwheel'));
  assert.ok(INSPIRATION_WEAPON_ARTS.spear.finish.includes('pierce'));
  assert.ok(INSPIRATION_WEAPON_ARTS.axe.middle.includes('bash'));
  assert.ok(INSPIRATION_WEAPON_ARTS.fist.finish.includes('barrage'));
  assert.ok(INSPIRATION_WEAPON_ARTS.fist.finish.includes('rushfist'));
  assert.ok(INSPIRATION_WEAPON_ARTS.katana.open.includes('katanaDraw'));
  assert.ok(INSPIRATION_WEAPON_ARTS.katana.middle.includes('katanaReturn'));
});

test('weighted phase entries are preserved while the global motion universe is unique', () => {
  assert.equal(INSPIRATION_WEAPON_ARTS.spear.open.filter(id => id === 'thrust').length, 2);
  assert.equal(new Set(INSPIRATION_MOTION_IDS).size, INSPIRATION_MOTION_IDS.length);
  assert.ok(INSPIRATION_MOTION_IDS.length > 9);
});

test('catalog is immutable and runtimes can request an isolated mutable clone', () => {
  assert.ok(Object.isFrozen(INSPIRATION_WEAPON_ARTS));
  assert.ok(Object.isFrozen(INSPIRATION_WEAPON_ARTS.sword));
  assert.ok(Object.isFrozen(INSPIRATION_WEAPON_ARTS.sword.open));

  const clone = cloneInspirationWeaponArts();
  clone.sword.open.push('test-only');
  clone.sword.tag = 'changed';
  assert.ok(!INSPIRATION_WEAPON_ARTS.sword.open.includes('test-only'));
  assert.equal(INSPIRATION_WEAPON_ARTS.sword.tag, '太刀');
});

test('unknown weapons fail closed instead of silently shrinking the candidate pool', () => {
  assert.throws(() => getInspirationWeaponArts('unknown'), /Unknown inspiration weapon/);
});
