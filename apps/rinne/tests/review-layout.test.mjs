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

test('a single floating 操作 button opens and closes the drawer', () => {
  assert.match(source, /button\('操作',\(\)=>setOpen\(true\),'review-controls-toggle'\)/);
  assert.match(source, /dock\.dataset\.open=String\(open\)/);
  assert.match(source, /toggle\.setAttribute\('aria-expanded',String\(open\)\)/);
  assert.match(source, /event\.key==='Escape'&&dock\.dataset\.open==='true'/);
});

test('skill composition is the primary flow and detailed controls start collapsed', () => {
  assert.match(source, /const advancedDetails=make\('details','','review-advanced-disclosure'\)/);
  assert.match(source, /advancedDetails\.append\(make\('summary','詳細設定'\)\)/);
  assert.match(source, /if\(skillPage\)notebook\.prepend\(skillPage\)/);
  assert.match(source, /play\.textContent='確認'/);
  assert.match(css, /\.review-controls-dock \.stage-row\{grid-template-columns:26px minmax\(0,1fr\) 62px!important/);
  assert.match(css, /\.review-controls-dock \.copy-slot\{display:none!important\}/);
});

test('secondary motions are available but collapsed behind その他の動作', () => {
  assert.match(source, /const secondary=make\('details','','review-secondary-disclosure'\)/);
  assert.match(source, /make\('summary','その他の動作'\)/);
  assert.match(source, /if\(!secondary\.open&&skillTab/);
});

test('landscape switches the control overlay to a right-side drawer without shrinking the canvas', () => {
  assert.match(css, /@media\(min-width:760px\),\(orientation:landscape\) and \(min-width:560px\)/);
  assert.match(css, /\.review-controls-dock\{left:auto;top:0;right:0;bottom:0;width:min\(430px,48vw\)/);
  assert.match(css, /transform:translateX\(calc\(100% \+ 12px\)\)/);
});
