import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const main = read('../index.html'), advanced = read('../advanced.html');
const engine = read('../src/review/character/runtime.js'), shell = read('../src/review/character/main.js'), grid = read('../src/review/character/grid.js');
const css = read('../src/character-review-main.css'), detailCss = read('../src/character-review-advanced.css');
const vite = read('../vite.config.js');
test('main and advanced retain every audited renderer control with unique IDs', () => {
  for (const html of [main, advanced]) {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const [,id] of engine.matchAll(/\bel\('([^']+)'\)/g)) assert.ok(ids.includes(id), id);
    for (const camera of ['overview','front','side','back','face']) assert.ok(html.includes(`data-camera="${camera}"`));
  }
});
test('model review is the visible purpose while detailed editing controls remain available underneath', () => {
  assert.match(main, /キャラクターモデル確認/);
  assert.match(main, /aria-label="キャラクターモデル確認"/);
  assert.equal([...main.matchAll(/role="tab"/g)].length, 5);
  for (const tab of ['parts','colors','motion','qa','compare']) assert.ok(main.includes(`data-tab="${tab}"`));
  assert.match(main, /id="compat-controls" hidden/);
  assert.match(main, /href="\.\/advanced\.html"/);
  assert.match(shell, /ArrowRight/); assert.match(shell, /ArrowLeft/);
  for (const id of ['undo','redo','save-workspace','original-preview']) assert.ok(main.includes(`id="${id}"`));
  for (const cls of ['review-slot-tabs','review-selection-current','review-choice-grid','review-choice-card','review-action-row']) assert.match(grid,new RegExp(cls));
  for (const id of ['seed','gene-height','session-file']) assert.ok(advanced.includes(`id="${id}"`));
});
test('both pages have bounded viewports and independent control scrolling', () => {
  assert.match(css, /html,body\{[^}]*overflow:hidden/);
  assert.match(css, /\.review-controls\{[^}]*overflow-y:auto/);
  assert.match(css, /grid-template-rows:minmax\(0,57fr\) minmax\(0,43fr\)/);
  assert.match(css, /\.canvas-wrap canvas\{[^}]*height:100%/);
  assert.match(css, /touch-action:none/);
  assert.match(detailCss, /\.advanced-review \.controls\{[^}]*overflow-y:auto/);
  assert.match(detailCss, /grid-template-rows:minmax\(0,60fr\) minmax\(0,40fr\)/);
});
test('renderer and visible shell remain isolated from game saves and authority', () => {
  assert.match(shell, /import '\.\/runtime\.js'/);
  assert.match(shell, /createCharacterWorkspace/);
  for (const code of [engine,shell]) assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection|\.innerHTML\s*=/);
  assert.match(main, /本編・セーブ・通信には接続しません/);
  assert.match(advanced, /class="back review-surface__back" data-review-back/);
});
test('model audit uses pinned CC0 KayKit identity, bounded loads and GPU recovery', () => {
  assert.match(engine, /KAYKIT_MODEL_BY_KEY/);
  assert.match(engine, /defaultModel = KAYKIT_MODEL_BY_KEY\.knight/);
  assert.match(engine, /defaultBytes = \(\) => modelBytes\(defaultModel\.runtime\.url\)/);
  assert.match(engine, /gitBlobSha/);
  assert.match(engine, /defaultModel\.source\.gitBlobSha/);
  assert.match(engine, /defaultModel\.license/);
  assert.doesNotMatch(engine, /SHINO_review\.vrm/);
  assert.ok(engine.indexOf('auditDocument(json, hash, bytes.byteLength, blobSha)') < engine.indexOf("new GLTFLoader().parseAsync(bytes, '')"));
  for (const expression of [/if \(!audit\.approved\) throw/, /length > MAX_MODEL_BYTES/, /file\.size > MAX_SESSION_BYTES/, /webglcontextlost/, /webglcontextrestored/, /createReviewStageLifecycle/]) assert.match(engine, expression);
  assert.doesNotMatch(engine, /new ResizeObserver/);
});
test('Character Studio is an independent two-entry dev-tool build', () => {
  assert.match(main, /data-dev-tool="character-studio"/);
  assert.match(vite, /appConfig\('character-studio',import\.meta\.url\)/);
  assert.match(vite, /main:fileURLToPath\(new URL\('\.\/index\.html'/);
  assert.match(vite, /advanced:fileURLToPath\(new URL\('\.\/advanced\.html'/);
  assert.doesNotMatch(vite, /characters\.html|apps\/rinne/);
});
