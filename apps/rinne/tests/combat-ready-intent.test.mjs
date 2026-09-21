import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife } from '../src/rebuild/domain.js';
import { resolveBodyIntent } from '../src/rebuild/combat-tactics.js';

function encounter() {
  const state = createLife({ seed: 6 });
  Object.assign(state, { phase: 'living', ageSeconds: 1200, ageYears: 20, zone: 'frontier', position: { x: 0, z: 0 }, yaw: 0 });
  const primary = { id: 'primary', x: .5, z: 1.4, dead: false, cooldown: .4, attackWindow: 0 };
  const secondary = { id: 'secondary', x: .5, z: 1, dead: false, cooldown: 0, attackWindow: 0 };
  return { state, primary, secondary };
}

test('ready secondary enemies do not starve automatic offense', () => {
  const { state, primary, secondary } = encounter();
  for (const cooldown of [0, -.5, -1]) {
    secondary.cooldown = cooldown;
    const intent = resolveBodyIntent(state, [primary, secondary], primary.id);
    assert.equal(intent.mode, 'attack');
    assert.equal(intent.bodyTargetId, primary.id);
  }
});

test('a committed secondary strike still receives directional defense, then releases offense', () => {
  const { state, primary, secondary } = encounter();
  secondary.attackWindow = .3;
  const defense = resolveBodyIntent(state, [primary, secondary], primary.id);
  assert.equal(defense.mode, 'guard');
  assert.equal(defense.bodyTargetId, secondary.id);
  assert.equal(defense.primaryTargetId, primary.id);
  secondary.attackWindow = 0;
  assert.equal(resolveBodyIntent(state, [primary, secondary], primary.id).mode, 'attack');
});

test('exhaustion still prevents offense even without a committed enemy strike', () => {
  const { state, primary, secondary } = encounter();
  state.stamina = 0;
  const intent = resolveBodyIntent(state, [primary, secondary], primary.id);
  assert.equal(intent.mode, 'recover');
  assert.equal(intent.stamina.allowOffense, false);
});
