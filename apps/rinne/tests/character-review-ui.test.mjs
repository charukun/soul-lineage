import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const main = read('../characters.html'), advanced = read('../characters-advanced.html');
const engine = read('../src/character-review.js'), shell = read('../src/character-review-main.js');
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
test('editing is primary, four keyboard tabs replace stacked diagnostic menus', () => {
  assert.equal([...main.matchAll(/role="tab"/g)].length, 4);
  for (const tab of ['parts','colors','motion','compare']) assert.ok(main.includes(`data-tab="${tab}"`));
  assert.match(main, /id="compat-controls" hidden/);
  assert.match(main, /href="\.\/characters-advanced\.html"/);
  assert.match(shell, /ArrowRight/); assert.match(shell, /ArrowLeft/);
  for (const id of ['undo','redo','save-workspace','original-preview']) assert.ok(main.includes(`id="${id}"`));
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
  assert.match(shell, /import '\.\/character-review\.js'/);
  assert.match(shell, /createCharacterWorkspace/);
  for (const code of [engine,shell]) assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection|\.innerHTML\s*=/);
  assert.match(main, /本編・セーブ・通信には接続しません/);
});
test('model audit, bounded loads and GPU recovery are preserved', () => {
  assert.match(engine, /new URL\('\.\/simulator\/assets\/SHINO_review\.vrm', location\.href\)/);
  assert.ok(engine.indexOf('auditShinoDocument(json, hash)') < engine.indexOf('new GLTFLoader().parseAsync(bytes'));
  for (const expression of [/if \(!audit\.approved\) throw/, /length > MAX_MODEL_BYTES/, /file\.size > MAX_SESSION_BYTES/, /webglcontextlost/, /webglcontextrestored/]) assert.match(engine, expression);
});
test('both review pages stay in the existing Rinne build', () => {
  assert.match(vite, /characters:fileURLToPath\(new URL\('\.\/characters\.html'/);
  assert.match(vite, /charactersAdvanced:fileURLToPath\(new URL\('\.\/characters-advanced\.html'/);
});
