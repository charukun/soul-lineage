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

test('Visual Review Lab exposes a real-model Tidebreak battle as a first-class review mode', async () => {
  const [sessionSource, shell, shellCss, viewer, viewerCss, audio, html, vite] = await Promise.all([
    read('apps/rinne/src/review/tidebreak-battle-session.js'),
    read('apps/rinne/src/review/battle-shell.js'),
    read('apps/rinne/src/review/battle-shell.css'),
    read('apps/rinne/src/review/battle-review.js'),
    read('apps/rinne/src/review/battle-review.css'),
    read('apps/rinne/src/review/battle-audio.js'),
    read('apps/rinne/battle-review.html'),
    read('apps/rinne/vite.config.js'),
  ]);

  assert.match(sessionSource, /new RaidHost/);
  assert.match(sessionSource, /@soul\/network\/raid-host/);
  assert.doesNotMatch(sessionSource, /createTidebreakRuntime/);

  assert.match(shell, /dataset\.primaryReview = 'battle'/);
  assert.match(shell, /battle-quick-link/);
  assert.match(shell, /classList\.add\('has-battle'\)/);
  assert.match(shell, /visual-review-battle-control/);
  assert.match(shell, /secondary\?\.contains\(page\)/);
  assert.match(shell, /battle-review\.html/);
  assert.match(shellCss, /review-primary-switch\.has-battle/);
  assert.match(shellCss, /battle-quick-link/);

  assert.match(viewer, /createTidebreakBattleSession/);
  assert.match(viewer, /installReviewExtensions/);
  assert.match(viewer, /new AbortController\(\)/);
  assert.match(viewer, /loadPreset\(\{[\s\S]*?presetId,[\s\S]*?signal,/);
  assert.match(viewer, /model\.SHINO/);
  assert.match(viewer, /model\.A/);
  assert.match(viewer, /createBattleAudio/);
  assert.match(viewer, /visual-review-battle-state/);
  assert.doesNotMatch(viewer, /軽量表示で戦闘を継続/);

  assert.match(audio, /AudioContext/);
  assert.match(audio, /function attack/);
  assert.match(audio, /function hit/);
  assert.match(audio, /function knockout/);

  assert.match(html, /Tidebreak 自動戦闘/);
  assert.match(html, /id="battle-sound"/);
  assert.match(html, /id="battle-retry"/);
  assert.match(viewerCss, /safe-area-inset-bottom/);
  assert.match(viewerCss, /100dvh/);
  assert.match(vite, /battleReview/);
});
