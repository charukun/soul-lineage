import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ux = read('../src/character-workshop-ux.js');
const css = read('../src/character-workshop-ux.css');
const entry = read('../src/motion-review-entrypoint.js');

test('workshop exposes only three primary mobile intentions', () => {
  for (const [key,label] of [['build','作る'],['move','動かす'],['compare','比べる']]) {
    assert.match(ux, new RegExp(`${key}: \\{ label: '${label}'`));
  }
  assert.match(ux, /nav\.replaceChildren\(\)/);
  assert.match(ux, /workshop-secondary-tabs/);
  assert.match(ux, /dataset\.workshopIntent/);
});

test('simple primary navigation no longer waits for optional motion QA controls', () => {
  assert.match(ux, /function installCore\(\)/);
  assert.match(ux, /!window\.characterStudio \|\| !qs\('\.mode-tabs'\) \|\| !qs\('\.review-controls'\)/);
  assert.match(ux, /function installOptionalTools\(\)/);
  assert.ok(ux.indexOf('buildIntentNavigation();') < ux.indexOf('installOptionalTools();'));
});

test('loading state is visible on the stage and reflects the real renderer progress', () => {
  for (const id of ['load-indicator','load-label','load-percent','load-fill','load-detail']) assert.match(ux, new RegExp(`\\.id = '${id}'`));
  for (const phase of ['モデル本体','骨格・動き','表示データ','GPU準備']) assert.match(ux, new RegExp(phase));
  assert.match(ux, /Number\(progress\.value\)/);
  assert.match(ux, /status\.textContent/);
  assert.match(ux, /performance\.now\(\)/);
  assert.match(css, /\.load-indicator\{/);
  assert.match(css, /\.load-indicator-track/);
});

test('motion comparison and diagnostics are opt-in instead of covering the stage', () => {
  assert.match(ux, /qa-live-toggle/);
  assert.match(ux, /getAttribute\('aria-pressed'\) === 'true'/);
  assert.match(ux, /live\.click\(\)/);
  assert.match(ux, /motionDebug = 'off'/);
  assert.match(ux, /qa-debug-toggle/);
  assert.match(ux, /workshop-qa-details/);
  assert.match(css, /html:not\(\[data-motion-debug="on"\]\) #motion-debug-overlay/);
});

test('mobile stage remains dominant and edit footer leaves review modes', () => {
  assert.match(css, /grid-template-rows:minmax\(0,64fr\) minmax\(0,36fr\)/);
  assert.match(css, /data-workshop-intent="move"\] \.editor-footer/);
  assert.match(css, /data-workshop-intent="compare"\] \.editor-footer/);
  assert.match(css, /\.stage-actions\{grid-template-columns:repeat\(3/);
});

test('restored UX is loaded by the existing workshop entry without adding authority', () => {
  assert.match(entry, /import '\.\/character-workshop-ux\.js'/);
  assert.doesNotMatch(ux, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection/);
  assert.doesNotMatch(ux, /fetch\(|gameState|saveGame/);
});
