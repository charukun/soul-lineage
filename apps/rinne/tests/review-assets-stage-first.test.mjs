import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const htmlUrl = new URL('../review-assets.html', import.meta.url);
const cssUrl = new URL('../src/review-asset-library.css', import.meta.url);
const jsUrl = new URL('../src/review-asset-library.js', import.meta.url);

test('equipment review is protagonist-first and weapon-type driven', async () => {
  const [html, css, js] = await Promise.all([
    readFile(htmlUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
    readFile(jsUrl, 'utf8'),
  ]);
  assert.match(html, /主人公の武器種/);
  assert.doesNotMatch(html, /素体選択|素体を選択/);
  assert.match(html, /id="asset-weapon-types"/);
  assert.match(js, /PROTAGONIST_VILLAGER_MODEL/);
  assert.match(js, /const WEAPON_TYPES = Object\.freeze\(\[/);
  for (const label of ['素手','剣','斧','杖','クロスボウ']) assert.match(js, new RegExp(`label:'${label}'`));
  assert.match(css, /\.asset-weapon-types\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
});

test('equipment review keeps the character preview primary on phones', async () => {
  const [html, css] = await Promise.all([
    readFile(htmlUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
  ]);
  assert.match(html, /class="asset-stage-hint"/);
  assert.match(css, /height:clamp\(440px,64dvh,680px\)/);
  assert.match(css, /\.asset-catalog::before/);
});

test('equipment slot copy follows the active slot', async () => {
  const js = await readFile(jsUrl, 'utf8');
  assert.match(js, /\$\{labels\[activeAssetSlot\]\}の装備を選択/);
  assert.match(js, /\$\{labels\[activeAssetSlot\]\}の装備を外す/);
});
