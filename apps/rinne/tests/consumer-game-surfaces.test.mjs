import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [html, confirmCss, surfaceCss] = await Promise.all([
  read('../index.html'),
  read('../src/life-confirm.css'),
  read('../src/consumer-game-surfaces.css'),
]);

test('consumer-game surface overrides load after legacy polish and before typography', () => {
  const native = html.indexOf('./src/native-ui-polish.css');
  const surfaces = html.indexOf('./src/consumer-game-surfaces.css');
  const typography = html.indexOf('./src/typography.css');
  assert.ok(native >= 0 && surfaces > native && typography > surfaces);
});

test('new-life replacement keeps behavior contract while using dimensional game framing', () => {
  assert.match(html, /id="replace-life-dialog"/);
  assert.match(html, /value="cancel"[^>]*>今の人生へ戻る/);
  assert.match(html, /value="replace"[^>]*>0歳から始める/);
  assert.match(confirmCss, /\.life-confirm-panel\{[\s\S]*clip-path:polygon/);
  assert.match(confirmCss, /\.life-confirm-panel::before/);
  assert.match(confirmCss, /\.life-confirm-panel::after/);
  assert.match(confirmCss, /box-shadow:[\s\S]*inset/);
  assert.match(confirmCss, /\.life-confirm-accept:hover,\.life-confirm-accept:focus-visible/);
  assert.match(confirmCss, /@media\(orientation:landscape\) and \(max-height:600px\)/);
  assert.match(confirmCss, /@media\(max-width:560px\)/);
  assert.doesNotMatch(confirmCss, /url\(/);
});

test('surface language is horizontally rolled out to settings, village and life end flows', () => {
  for (const selector of ['.title-settings-dialog', '#village-dialog', '.life-end-dialog']) {
    assert.ok(surfaceCss.includes(selector), `${selector} must be covered by the shared game-surface layer`);
  }
  assert.match(surfaceCss, /#village-dialog \.coop-menu textarea/);
  assert.match(surfaceCss, /#village-dialog \.coop-actions button/);
  assert.match(surfaceCss, /\.life-end-dialog select/);
  assert.match(surfaceCss, /\.life-end-dialog #rebirth/);
  assert.match(surfaceCss, /\.life-end-dialog \.rinne-choice\[data-selected="true"\]/);
  assert.match(surfaceCss, /\.title-settings-dialog \.setting-row/);
  assert.match(surfaceCss, /\.title-settings-dialog \.setting-switch\[aria-checked="true"\]/);
});

test('portrait and landscape layouts are deliberate instead of stretched', () => {
  assert.match(surfaceCss, /@media\(max-width:560px\)[\s\S]*#village-dialog \.coop-actions\{display:grid;grid-template-columns:1fr 1fr\}/);
  assert.match(surfaceCss, /@media\(orientation:landscape\) and \(max-height:600px\)[\s\S]*#village-dialog \.coop-actions\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(surfaceCss, /@media\(orientation:landscape\) and \(max-height:600px\)[\s\S]*\.life-end-dialog form\{grid-template-columns:minmax\(0,\.85fr\) minmax\(0,1\.15fr\)/);
  assert.match(confirmCss, /@media\(max-width:560px\)[\s\S]*\.life-confirm-accept\{order:-1\}/);
});
