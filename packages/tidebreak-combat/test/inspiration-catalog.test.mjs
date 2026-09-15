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
