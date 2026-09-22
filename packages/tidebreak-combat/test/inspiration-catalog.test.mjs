import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INSPIRATION_WEAPONS, cloneInspirationWeaponArts} from '@soul/game-data';
import {createTidebreakRuntime} from '../index.js';

const canonical = cloneInspirationWeaponArts();

function allowedKinds(weapon) {
  const arts = canonical[weapon];
  return new Set([...arts.open, ...arts.middle, ...arts.finish]);
}

test('Tidebreak exposes the exact shared inspiration catalog it executes against', () => {
  const runtime = createTidebreakRuntime({weapon: 'sword'});
  assert.deepEqual(runtime.inspirationCatalog(), canonical);
  assert.match(runtime.sourceVersion, /shared-inspiration catalog/);
  assert.match(runtime.sourceVersion, /shared-contact-impact/);
  assert.equal(runtime.weaponSpec('sword').tip, 1.62);
  assert.equal(runtime.weaponSpec('dagger').ideal, 1.02);
  assert.equal(runtime.weaponSpec('staff').ideal, 1.62);
  runtime.configure({weapon:'sword',hp:100,maxhp:100,enemyHp:100,positions:{hero:{x:-1,z:0},enemy:{x:1,z:0}}});
  const before=runtime.state();
  assert.equal(before.hero.weaponSegment.weapon,'sword');
  assert.ok(before.hero.weaponSegment.visualTip.length===3&&before.hero.weaponSegment.visualBase.length===3);
  const impacted=runtime._test.hit('enemy',12);
  assert.ok(impacted.impacts.length>=1);
  assert.equal(impacted.impacts.at(-1).sourceHero,true);
  assert.ok(impacted.feel.slowRemaining>0);
  assert.ok(Math.hypot(impacted.enemy.knockback.x,impacted.enemy.knockback.z)>0);
  runtime.configure({weapon:'sword',opponent:'group',enemyHp:80,positions:{hero:{x:-2,z:0},enemies:[{x:2,z:0},{x:2,z:-1.5},{x:2,z:1.5}]}});
  assert.equal(runtime.state().enemies.length,3);
});

test('actual inspiration generation only emits motions from the shared weapon catalog', () => {
  const runtime = createTidebreakRuntime({weapon: 'sword'});
  for (const weapon of INSPIRATION_WEAPONS) {
    const allowed = allowedKinds(weapon);
    for (let i = 0; i < 32; i++) {
      const skill = runtime._test.generateSkill(weapon, 'jo', true);
      assert.equal(skill.weapon, weapon);
      const kinds = skill.steps.map(step => step.kind).filter(kind => kind && kind !== 'none');
      assert.ok(kinds.length >= 1 && kinds.length <= 3);
      for (const kind of kinds) {
        assert.ok(allowed.has(kind), `${weapon} generated non-canonical inspiration motion: ${kind}`);
      }
    }
  }
});

test('Tidebreak no longer owns embedded weapon-art candidate definitions', async () => {
  const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(source, /cloneInspirationWeaponArts/);
  assert.doesNotMatch(source, /const WEAPON_ARTS=\{/);
  assert.doesNotMatch(source, /WEAPON_ARTS\.fist=/);
  assert.doesNotMatch(source, /WEAPON_ARTS\.katana=/);
  assert.doesNotMatch(source, /finish\.push\('bullrush','meteor'\)/);
  assert.doesNotMatch(source, /WEAPON_ARTS\.spear\.middle\.push\('spearwheel'\)/);
});
