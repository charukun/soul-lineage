import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css = await readFile(new URL('../src/gameplay-upgrade.css', import.meta.url), 'utf8');
const nativeUi = await readFile(new URL('../src/native-ui-polish.css', import.meta.url), 'utf8');
const reviewUi = await readFile(new URL('../src/develop-review.css', import.meta.url), 'utf8');

test('gameplay panel remains inside the mobile safe area', () => {
  assert.match(css, /\.upgrade-panel\{[\s\S]*left:max\(10px,env\(safe-area-inset-left\)\)[\s\S]*right:max\(10px,env\(safe-area-inset-right\)\)[\s\S]*max-height:min\(66dvh,610px\)/);
  assert.match(css, /\.upgrade-panel>header button\{[^}]*flex:0 0 42px;[^}]*width:42px;[^}]*height:42px/);
});

test('objective card keeps content height instead of stretching from top to bottom', () => {
  assert.match(css, /\.game-screen\[data-gameplay-upgrade\] \.objective-card\{bottom:auto;max-width:/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.game-screen\[data-gameplay-upgrade\] \.objective-card\{bottom:auto\}/);
});

test('landscape objective card switches anchors deliberately', () => {
  assert.match(css, /@media\(max-height:560px\) and \(orientation:landscape\)[\s\S]*\.game-screen\[data-gameplay-upgrade\] \.objective-card\{top:auto;right:auto;bottom:12px;left:12px\}/);
});

test('multi-option selectors never collapse into vertical one-column lists', () => {
  assert.match(nativeUi, /\.title-actions\{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(nativeUi, /\.rinne-choice-list\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(nativeUi, /@media\(max-width:700px\)[\s\S]*\.title-actions\{[^}]*width:min\(94vw,560px\)/);
  assert.doesNotMatch(nativeUi, /@media\(max-width:[^)]+\)[\s\S]*\.rinne-choice-list\{[^}]*grid-template-columns:1fr/);
  assert.match(reviewUi, /@media\(max-width:700px\)\{[\s\S]*\.review-nav\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(reviewUi, /\.review-nav\{[^}]*grid-template-columns:(?:1fr|1fr 1fr)/);
});
