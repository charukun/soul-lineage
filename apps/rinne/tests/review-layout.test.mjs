import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/review/review-controls.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/review/review-controls.js', import.meta.url), 'utf8');

test('portrait gives the canvas 70% of the space below the header/loading strip', () => {
  assert.match(css, /grid-template-rows:var\(--review-topbar-height\) auto minmax\(0,7fr\) minmax\(0,3fr\)/);
  assert.doesNotMatch(css, /minmax\((?:96|108|120|210|230)px,/);
  assert.match(css, /height:100dvh/);
});

test('desktop and landscape use the same 70:30 split without a fixed control minimum', () => {
  assert.match(css, /@media\(min-width:900px\),\(orientation:landscape\) and \(max-height:600px\)/);
  assert.match(css, /grid-template-columns:minmax\(0,7fr\) minmax\(0,3fr\)/);
  assert.doesNotMatch(css, /minmax\(300px,40%\)/);
});

test('all existing controls move together into a single independent scroll region', () => {
  assert.match(source, /dock\.append\(quick,q\('\.panel'\)\)/);
  assert.match(source, /dock\.scrollTop=0/);
  assert.match(css, /\.review-shell>\.review-controls-dock,\.review-shell>\.panel\{[^}]*min-height:0;overflow:auto;overscroll-behavior:contain/);
  assert.match(css, /\.review-shell \.notebook-scroll\{[^}]*overflow:visible/);
  assert.match(css, /\.review-controls-dock>\.quick-review,\.review-controls-dock>\.panel\{flex:0 0 auto\}/);
});

test('initialization stays idempotent and the canvas remains in its own grid cell', () => {
  assert.match(source, /if\(q\('#focused-review'\)\)return/);
  assert.match(source, /q\('\.viewport'\)\.after\(dock\)/);
  assert.match(css, /\.review-shell>\.viewport\{grid-area:3\/1\/4\/2/);
  assert.match(css, /\.review-shell #review-canvas\{width:100%!important;height:100%!important/);
});
