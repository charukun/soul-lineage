import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../characters.html');
const advanced = read('../characters-advanced.html');
const engine = read('../src/character-review.js');
const shell = read('../src/character-review-main.js');
const mainCss = read('../src/character-review-main.css');
const advancedCss = read('../src/character-review-advanced.css');
const vite = read('../vite.config.js');
const ids = text => [...text.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test('main and advanced pages satisfy the renderer controller contract with unique ids', () => {
  for (const [name, html] of [['main', main], ['advanced', advanced]]) {
    const pageIds = ids(html);
    assert.equal(pageIds.length, new Set(pageIds).size, `${name} has duplicate ids`);
    for (const [, id] of engine.matchAll(/\bel\('([^']+)'\)/g)) assert.ok(pageIds.includes(id), `${name} missing #${id}`);
    for (const camera of ['overview', 'front', 'back', 'side', 'face']) assert.ok(html.includes(`data-camera="${camera}"`), `${name} missing ${camera} camera`);
  }
});

test('main page is a review console and details are separated', () => {
  assert.match(main, /class="review-main"/);
  assert.equal([...main.matchAll(/data-review-mode="/g)].length, 6);
  assert.match(main, /data-review-mode="population"/);
  assert.match(main, /data-review-mode="age"/);
  assert.match(main, /data-review-mode="color"/);
  assert.match(main, /data-review-mode="expression"/);
  assert.match(main, /data-review-mode="spring"/);
  assert.match(main, /data-review-mode="performance"/);
  assert.match(main, /id="compat-controls" hidden/);
  assert.match(main, /href="\.\/characters-advanced\.html"/);
  assert.match(advanced, /id="seed"/);
  assert.match(advanced, /id="gene-height"/);
  assert.match(advanced, /id="session-file"/);
  assert.match(advanced, /通常の見た目確認はメイン画面/);
});

test('mobile review keeps stage and controls in independent viewport regions', () => {
  assert.match(mainCss, /html,body\{[^}]*overflow:hidden/);
  assert.match(mainCss, /\.review-controls\{[^}]*overflow-y:auto/);
  assert.match(mainCss, /grid-template-rows:minmax\(310px,57dvh\) minmax\(0,1fr\)/);
  assert.match(mainCss, /\.canvas-wrap canvas\{[^}]*height:100%/);
  assert.match(mainCss, /touch-action:none/);
  assert.match(advancedCss, /\.advanced-review \.stage-panel\{position:sticky;top:0/);
});

test('review shell only drives the isolated controller and does not add persistence or authority', () => {
  assert.match(shell, /import '\.\/character-review\.js'/);
  assert.match(shell, /data-review-mode/);
  assert.match(shell, /new MutationObserver/);
  assert.doesNotMatch(shell, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection|innerHTML/);
  assert.match(main, /本編・セーブ・通信には接続しません/);
});

test('model loading remains audited and bounded', () => {
  assert.match(engine, /new URL\('\.\/simulator\/assets\/SHINO_review\.vrm', location\.href\)/);
  assert.ok(engine.indexOf('auditShinoDocument(json, hash)') < engine.indexOf('new GLTFLoader().parseAsync(bytes'));
  assert.match(engine, /if \(!audit\.approved\) throw/);
  assert.match(engine, /length > MAX_MODEL_BYTES/);
  assert.match(engine, /file\.size > MAX_SESSION_BYTES/);
  assert.match(engine, /webglcontextlost/);
  assert.match(engine, /webglcontextrestored/);
  assert.doesNotMatch(engine, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection|\.innerHTML\s*=/);
});

test('both simulator pages are production build inputs', () => {
  assert.match(vite, /characters:fileURLToPath\(new URL\('\.\/characters\.html'/);
  assert.match(vite, /charactersAdvanced:fileURLToPath\(new URL\('\.\/characters-advanced\.html'/);
});
