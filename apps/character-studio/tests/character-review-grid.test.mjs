import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const code = read('character-review-grid.js');
const css = read('character-review-grid.css');
const auto = read('review-slot-auto.js');
const { readCharacterReviewGroups, gridFocusIndex, installCharacterReviewGrid } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace("import './character-review-grid.css';", '')).toString('base64')}`
);
function source(label, { pressed = false, disabled = false, ariaLabel = '', swatch = '', camera, tick = false } = {}) {
  return {
    dataset: camera ? { camera } : {}, isConnected: true,
    getAttribute: name => name === 'aria-pressed' ? String(pressed) : name === 'aria-label' ? ariaLabel : null,
    matches: selector => selector === ':disabled' && disabled,
    querySelector: selector => selector === 'i' && swatch ? { style: { backgroundColor: swatch } } : null,
    cloneNode() {
      const clone = { textContent: label + (tick ? '選択中' : '') };
      clone.querySelectorAll = () => tick ? [{ remove: () => { clone.textContent = label; } }] : [];
      return clone;
    }
  };
}
function readGroups(rows, ready = true, camera = 'front') {
  return readCharacterReviewGroups({ querySelectorAll: selector => rows[selector] || [] }, ready, camera);
}

test('nine editable review groups share one slot-to-grid catalogue, with no technical build action', () => {
  const groups = readGroups({});
  assert.deepEqual(groups.map(row => row.id), ['model','part','variant','individual','hair','eyes','skin','dye','age']);
  assert.equal(new Set(groups.map(row => row.id)).size, 9);
  assert.match(code, /#character-model-options \[data-character-model\]/);
  assert.doesNotMatch(code, /character-build-request/);
});

test('slots reflect the actual selected source, remove ticks, and preserve full accessible labels', () => {
  const first = source('少年'), second = source('少女', { pressed: true, ariaLabel: '少女モデルの全ラベル', tick: true });
  const model = readGroups({ '#character-model-options [data-character-model]': [first, second] })[0];
  assert.equal(model.value, '少女');
  assert.deepEqual(model.options.map(row => row.selected), [false, true]);
  assert.equal(model.options[1].fullLabel, '少女モデルの全ラベル');
  assert.equal(model.options[1].source, second);
});

test('custom age does not falsely select the first age preset', () => {
  const age = readGroups({ '#age-options [data-age]': [source('0歳'), source('22歳')] }).find(row => row.id === 'age');
  assert.equal(age.value, 'カスタム');
  assert.equal(age.options.filter(row => row.selected).length, 0);
});

test('loading and inherited fieldset disabled states both disable live candidates', () => {
  const rows = { '#slot-tabs [data-slot]': [source('髪', { pressed: true }), source('顔', { disabled: true })] };
  assert.deepEqual(readGroups(rows)[1].options.map(row => row.disabled), [false, true]);
  assert.deepEqual(readGroups(rows, false)[1].options.map(row => row.disabled), [true, true]);
  assert.equal(readGroups({}, false)[0].value, '読込中');
});

test('palette colours are copied from real swatches rather than invented', () => {
  const group = readGroups({ '#color-options [data-gene="hair"]': [source('茶', { pressed: true, swatch: 'rgb(102, 72, 47)' })] }).find(row => row.id === 'hair');
  assert.equal(group.value, '茶');
  assert.equal(group.options[0].swatch, 'rgb(102, 72, 47)');
});

test('keyboard navigation matches five columns and skips disabled cells safely', () => {
  const items = Array.from({ length: 10 }, () => ({ disabled: false }));
  assert.equal(gridFocusIndex(items, 1, 'ArrowDown'), 6);
  assert.equal(gridFocusIndex(items, 6, 'ArrowUp'), 1);
  assert.equal(gridFocusIndex(items, 0, 'ArrowLeft'), 0);
  assert.equal(gridFocusIndex(items, 9, 'ArrowRight'), 9);
  items[5].disabled = true;
  assert.equal(gridFocusIndex(items, 4, 'ArrowRight'), 6);
  assert.equal(gridFocusIndex(items, 6, 'Home'), 0);
  assert.equal(gridFocusIndex(items, 1, 'End'), 9);
  assert.equal(gridFocusIndex(items, 1, 'Enter'), 1);
});

test('installation is character-only and idempotent before querying or changing the legacy UI', () => {
  assert.equal(installCharacterReviewGrid({ body: { dataset: { reviewMode: 'motion' } } }, {}), false);
  assert.equal(installCharacterReviewGrid({ body: { dataset: { reviewMode: 'character' } }, getElementById: () => ({}) }, {}), false);
  assert.match(auto, /if\(mode==='character'\)\{installCharacterReviewGrid\(\);return;\}/);
  assert.ok(auto.indexOf("if(mode==='character'){installCharacterReviewGrid();return;}") < auto.indexOf('  installStageCameraSlot();'));
  assert.doesNotMatch(auto, /mountReviewGroup\(byId\('part-options'\)/);
});

test('candidates stay visible in five columns; original duplicate controls are scoped out', () => {
  assert.match(css, /\.character-review-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.character-review-slots\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /body\.character-grid-ready \.review-controls > :not\(#character-review-picker\)/);
  assert.doesNotMatch(code, /aria-haspopup|review-slot-panel|localStorage|sessionStorage|fetch\(/);
  assert.match(code, /option\.source\.click\(\)/);
  assert.match(code, /!option\.source\.isConnected \|\| option\.source\.matches\(':disabled'\)/);
  assert.match(code, /if \(!ready\) state\.framed = false/);
  assert.match(code, /if \(!event\.persisted\)/);
});
