import test from 'node:test';
import assert from 'node:assert/strict';
import { createTidebreakRuntime } from '../index.js';

const attack = { id: 'live-policy-sword', name: '剣の型', type: 'normal', weapon: 'sword', element: 'steel', rhythm: 'flow', tempo: 1.05, aura: 'none', steps: [{ kind: 'slash', footwork: 'forward', charge: 'none' }, { kind: 'thrust', footwork: 'chase', charge: 'none' }, { kind: 'back', footwork: 'orbitR', charge: 'none' }] };
const loadout = { jo: attack, ha: attack, kyu: attack };
const frameIdentity = state => ({ time: state.time, hero: [state.hero.id, state.hero.x, state.hero.z, state.hero.yaw, state.hero.hp, state.hero.attack, state.hero.progress, state.hero.slot], enemy: [state.enemy.id, state.enemy.x, state.enemy.z, state.enemy.hp, state.enemy.attack, state.enemy.progress], stats: state.stats });

test('live policy changes preserve draw, committed motion, damage and simulation time', () => {
  const runtime = createTidebreakRuntime({ seed: 6, weapon: 'sword' });
  runtime.configure({ weapon: 'sword', opponent: 'dummy', loadout, mindset: 'balanced', hp: 1000, enemyHp: 1000, positions: { hero: { x: 0, z: 0, yaw: 0 }, enemy: { x: 0, z: 1.4, yaw: Math.PI } } });
  let sawAttack = false, sawDamage = false;
  for (let frame = 0; frame < 180; frame++) {
    const before = runtime.state();
    const after = runtime.updatePolicy({ loadout, mindset: 'balanced', enemyLoadout: null });
    assert.deepEqual(frameIdentity(after), frameIdentity(before), 'policy update must not advance or reset either actor');
    const next = runtime.step(1 / 60);
    assert.ok(next.time > before.time);
    sawAttack ||= Boolean(next.hero.attack);
    sawDamage ||= next.stats.damage > 0;
  }
  assert.ok(sawAttack, 'repeated policy updates must allow an authored attack to begin');
  assert.ok(sawDamage, 'repeated policy updates must allow a real contact to land');
});

test('structural weapon changes cannot pass through live policy updates', () => {
  const runtime = createTidebreakRuntime({ seed: 6, weapon: 'sword' });
  runtime.configure({ weapon: 'sword', loadout });
  runtime.step(1 / 60);
  const before = frameIdentity(runtime.state());
  assert.throws(() => runtime.updatePolicy({ weapon: 'katana', loadout }), /cannot replace a weapon/);
  assert.deepEqual(frameIdentity(runtime.state()), before);
});
