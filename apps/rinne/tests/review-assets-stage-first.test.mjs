import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const htmlUrl = new URL('../review-assets.html', import.meta.url);
const cssUrl = new URL('../src/review-asset-library.css', import.meta.url);
const jsUrl = new URL('../src/review-asset-library.js', import.meta.url);

test('equipment review keeps the character preview primary on phones', async () => {
  const [html, css] = await Promise.all([
    readFile(htmlUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
  ]);
  assert.match(html, /class="asset-stage-hint"/);
  assert.match(css, /height:clamp\(440px,64dvh,680px\)/);
  assert.match(css, /\.asset-catalog::before/);
  assert.match(css, /\.asset-equipment-options,.model-options\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important\}/);
});

test('equipment slot copy follows the active slot', async () => {
  const js = await readFile(jsUrl, 'utf8');
  assert.match(js, /\$\{labels\[activeAssetSlot\]\}の装備を選択/);
  assert.match(js, /\$\{labels\[activeAssetSlot\]\}の装備を外す/);
});
