import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css = await readFile(new URL('../src/gameplay-upgrade.css', import.meta.url), 'utf8');

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
