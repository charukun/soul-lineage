import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/review/review-controls.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/review/review-controls.js', import.meta.url), 'utf8');

test('review canvas owns the full viewport while controls overlay it', () => {
  assert.match(css, /\.review-shell\{[^}]*position:relative!important;[^}]*height:100dvh!important;[^}]*display:block!important/);
  assert.match(css, /\.review-shell>\.viewport\{[^}]*position:absolute!important;[^}]*inset:0!important;[^}]*height:100%!important/);
  assert.match(css, /\.review-controls-dock\{[^}]*position:fixed;[^}]*transform:translateY/);
  assert.match(css, /\.review-controls-dock\[data-open=true\]\{transform:translateY\(0\)\}/);
});

test('floating 操作 and 指摘 actions keep the viewer task-first', () => {
  assert.match(source, /button\('操作',\(\)=>setOpen\(true\),'review-controls-toggle'\)/);
  assert.match(source, /button\('指摘',\(\)=>feedback\.click\(\),'review-feedback-toggle'\)/);
  assert.match(source, /feedback\.textContent='指摘する'/);
  assert.match(source, /dock\.dataset\.open=String\(open\)/);
  assert.match(source, /event\.key==='Escape'&&dock\.dataset\.open==='true'/);
  assert.match(css, /\.review-feedback-toggle\{/);
});

test('skill composition is primary, repeat review is the default, and details start collapsed', () => {
  assert.match(source, /const advancedDetails=make\('details','','review-advanced-disclosure'\)/);
  assert.match(source, /advancedDetails\.append\(make\('summary','詳細設定'\)\)/);
  assert.match(source, /if\(skillPage\)notebook\.prepend\(skillPage\)/);
  assert.match(source, /play\.textContent='↻ 確認'/);
  assert.match(source, /queueMicrotask\(\(\)=>\{const loop=q\('#loop-toggle'\)/);
  assert.match(source, /loop\.checked=true;loop\.dispatchEvent\(new Event\('change'/);
  assert.match(source, /止めるまで繰り返します/);
  assert.match(css, /\.review-controls-dock \.stage-row\{grid-template-columns:30px minmax\(0,1fr\) 72px!important/);
  assert.match(css, /\.review-controls-dock \.copy-slot\{display:none!important\}/);
});

test('secondary motions are available but collapsed behind その他の動作', () => {
  assert.match(source, /const secondary=make\('details','','review-secondary-disclosure'\)/);
  assert.match(source, /make\('summary','その他の動作'\)/);
  assert.match(source, /if\(!secondary\.open&&skillTab/);
});

test('new graphite review-monitor theme replaces the old notebook-like chrome', () => {
  assert.match(css, /--bg:#07090d/);
  assert.match(css, /--gold:#c9ff67/);
  assert.match(css, /backdrop-filter:blur\(26px\)/);
  assert.match(css, /\.review-feedback-dialog\{[^}]*background:#0b0e13f5!important/);
  assert.match(css, /\.picker-sheet\{[^}]*background:#0b0e13f7!important/);
});

test('landscape switches the control overlay to a right-side drawer without shrinking the canvas', () => {
  assert.match(css, /@media\(min-width:760px\),\(orientation:landscape\) and \(min-width:560px\)/);
  assert.match(css, /\.review-controls-dock\{left:auto;top:8px;right:8px;bottom:8px;width:min\(430px,48vw\)/);
  assert.match(css, /transform:translateX\(calc\(100% \+ 20px\)\)/);
});
