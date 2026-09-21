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
  assert.match(html, /aria-label="主人公の武器種"/);
  assert.doesNotMatch(html, /素体選択|素体を選択/);
  assert.match(html, /id="asset-weapon-types"/);
  assert.match(js, /PROTAGONIST_VILLAGER_MODEL/);
  assert.match(js, /const WEAPON_TYPES = Object\.freeze\(\[/);
  for (const label of ['素手','剣','斧','杖','クロスボウ']) assert.match(js, new RegExp(`label:'${label}'`));
  assert.match(css, /\.asset-weapon-types\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
});

test('equipment review removes duplicate chrome from the primary flow', async () => {
  const [html, css, js] = await Promise.all([
    readFile(htmlUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
    readFile(jsUrl, 'utf8'),
  ]);
  assert.doesNotMatch(html, /asset-combination|asset-stage-hint|asset-camera-strip|asset-candidate-label|asset-clear-slot/);
  assert.equal((html.match(/data-asset-camera=/g) || []).length, 1);
  assert.match(html, /class="asset-stage-front"/);
  assert.match(html, /<details class="asset-equipment-details">/);
  assert.doesNotMatch(html, /<details class="asset-equipment-details"[^>]*\sopen/);
  assert.match(css, /\.asset-stage-front\{/);
  assert.match(css, /\.asset-equipment-details>summary\{/);
  assert.doesNotMatch(js, /asset-combination|asset-candidate-label|asset-clear-slot/);
});

test('equipment review keeps the character preview primary on phones', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /height:clamp\(440px,64dvh,680px\)/);
  assert.match(css, /\.asset-catalog::before/);
});
