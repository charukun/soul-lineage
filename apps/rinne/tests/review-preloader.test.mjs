import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REVIEW_PRELOAD_GROUPS, reviewPreloadLabel } from '../src/review-preloader.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../review.html');
const worker = read('../public/review-preload-sw.js');

test('Visual Review launcher gives every menu a background preload indicator', () => {
  const targets = ['characters', 'motion', 'assets', 'effects', 'battle'];
  assert.deepEqual(Object.keys(REVIEW_PRELOAD_GROUPS), targets);
  for (const target of targets) {
    assert.match(html, new RegExp(`data-review-target="${target}"[^>]*data-preload-state="queued"`));
  }
  assert.equal((html.match(/data-review-preload-state/g) || []).length, targets.length);
});

test('preload groups warm each route and its initial heavyweight dependency', () => {
  assert.equal(REVIEW_PRELOAD_GROUPS.characters.route, './characters.html?review=character');
  assert.ok(REVIEW_PRELOAD_GROUPS.characters.assets.includes('./simulator/assets/kaykit/Knight.glb'));
  assert.ok(REVIEW_PRELOAD_GROUPS.motion.assets.includes('./simulator/assets/kaykit/Knight.glb'));
  assert.ok(REVIEW_PRELOAD_GROUPS.assets.assets.includes('./asset-review/models/kaykit-skeletons/Skeleton_Warrior.glb'));
  assert.ok(REVIEW_PRELOAD_GROUPS.effects.assets.some(path => path.endsWith('/effekseer.wasm')));
  assert.ok(REVIEW_PRELOAD_GROUPS.battle.assets.includes('./simulator/assets/kaykit/Rogue.glb'));
  assert.ok(REVIEW_PRELOAD_GROUPS.battle.assets.includes('./simulator/assets/kaykit/Knight.glb'));
});

test('launcher status stays understandable while a menu remains clickable', () => {
  assert.equal(reviewPreloadLabel({state: 'loading', completed: 1, total: 4}), '準備中 25%');
  assert.equal(reviewPreloadLabel({state: 'ready', completed: 4, total: 4}), '準備済');
  assert.equal(reviewPreloadLabel({state: 'error'}), '直接読込');
  assert.doesNotMatch(html, /disabled/);
});

test('worker keeps preload work alive across launcher navigation and reuses in-flight resources', () => {
  assert.match(worker, /event\.waitUntil\(activeRun\)/);
  assert.match(worker, /self\.addEventListener\('fetch'/);
  assert.match(worker, /const inflight = new Map\(\)/);
  assert.match(worker, /cache: 'force-cache'/);
  assert.match(worker, /pending\.then\(responseFromPayload\)/);
});
