import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AUTO_BATTLE_STEP, createTidebreakBattleSession } from '../src/review/tidebreak-battle-session.js';

const read = path => readFile(path, 'utf8');

test('Visual Review Lab battle session runs the real Tidebreak auto combat to a result', () => {
  const session = createTidebreakBattleSession();
  let state = session.state();
  const initial = { hero: state.hero.hp, enemy: state.enemy.hp };
  let sawAttack = Boolean(state.hero.attack || state.enemy.attack);
  let sawDamage = false;

  for (let i = 0; i < 4000 && !state.finished; i++) {
    state = session.step(AUTO_BATTLE_STEP);
    sawAttack ||= Boolean(state.hero.attack || state.enemy.attack);
    sawDamage ||= state.hero.hp < initial.hero || state.enemy.hp < initial.enemy;
  }

  assert.equal(state.finished, true);
  assert.match(state.winner, /^(demon|human)$/);
  assert.equal(sawAttack, true);
  assert.equal(sawDamage, true);
  assert.match(state.sourceVersion, /^Tidebreak /);
  assert.ok(state.hero.hp <= initial.hero);
  assert.ok(state.enemy.hp <= initial.enemy);
});

test('Visual Review Lab exposes battle as a primary embedded review mode without copying combat runtime', async () => {
  const [sessionSource, shell, viewer, html, vite] = await Promise.all([
    read('apps/rinne/src/review/tidebreak-battle-session.js'),
    read('apps/rinne/src/review/battle-shell.js'),
    read('apps/rinne/src/review/battle-review.js'),
    read('apps/rinne/battle-review.html'),
    read('apps/rinne/vite.config.js'),
  ]);

  assert.match(sessionSource, /new RaidHost/);
  assert.match(sessionSource, /@soul\/network\/raid-host/);
  assert.doesNotMatch(sessionSource, /createTidebreakRuntime/);
  assert.match(shell, /dataset\.primaryReview = 'battle'/);
  assert.match(shell, /visual-review-battle-control/);
  assert.match(shell, /secondary\?\.contains\(page\)/);
  assert.match(viewer, /createTidebreakBattleSession/);
  assert.match(viewer, /installReviewExtensions/);
  assert.match(viewer, /model\.SHINO/);
  assert.match(viewer, /model\.A/);
  assert.match(viewer, /visual-review-battle-state/);
  assert.match(html, /Tidebreak 自動戦闘/);
  assert.match(vite, /battleReview/);
});
