import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KAYKIT_GAME_AXIS, isKayKitPlayableModel, primaryKayKitModel } from '../src/kaykit-game-axis.js';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Rinne declares KayKit as the primary game construction axis', () => {
  assert.equal(KAYKIT_GAME_AXIS.id, 'kaykit-first-v1');
  assert.equal(primaryKayKitModel(), 'knight');
  assert.deepEqual(KAYKIT_GAME_AXIS.playableModels, ['knight', 'rogue', 'mage', 'barbarian']);
  assert.ok(KAYKIT_GAME_AXIS.playableModels.every(isKayKitPlayableModel));
  assert.equal(KAYKIT_GAME_AXIS.policy.shinoIsRequiredForNewGameplay, false);
  assert.equal(KAYKIT_GAME_AXIS.policy.shinoIsCompatibilityReference, true);
  assert.equal(KAYKIT_GAME_AXIS.source.adventurers.commit, '672074b73ba276876a19e8816ecdc5241817ab47');
  assert.equal(KAYKIT_GAME_AXIS.source.adventurers.license, 'CC0-1.0');
});

test('KayKit-first runtime is an actual playable loop, not a model-only preview', () => {
  const game = source('../public/lanternfell/game.mjs');
  const view = source('../public/lanternfell/view.mjs');
  const assets = source('../public/lanternfell/assets.mjs');
  assert.match(game, /export const QUESTS=/);
  assert.match(game, /export const FURNITURE=/);
  assert.match(game, /spawnEnemy/);
  assert.match(view, /CLASS_MODEL/);
  assert.match(view, /syncActors\(game/);
  assert.match(assets, /KayKit-Character-Pack-Adventures-1\.0/);
  assert.match(assets, /knight:\['adventurers'/);
});

test('the main title exposes KayKit-first play without removing the 100-year compatibility runtime', () => {
  const html = source('../index.html');
  const main = source('../src/main.js');
  assert.match(html, /id="kaykit-life"/);
  assert.match(html, /KayKitで遊ぶ/);
  assert.match(main, /KAYKIT_GAME_AXIS/);
  assert.match(main, /primaryRuntime/);
  assert.match(main, /new-life/);
});
