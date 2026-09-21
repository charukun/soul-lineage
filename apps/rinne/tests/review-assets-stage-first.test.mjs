import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const htmlUrl = new URL('../review-assets.html', import.meta.url);
const cssUrl = new URL('../src/review-asset-library.css', import.meta.url);
const jsUrl = new URL('../src/review-asset-library.js', import.meta.url);

test('equipment review equips the selected weapon type directly', async () => {
  const [html, css, js] = await Promise.all([
    readFile(htmlUrl, 'utf8'),
    readFile(cssUrl, 'utf8'),
    readFile(jsUrl, 'utf8'),
  ]);
  assert.match(html, /装備箇所/);
  assert.match(html, /武器の種類/);
  assert.doesNotMatch(html, /右手の装備候補|装備候補/);
  assert.doesNotMatch(html, /asset-equipment-options|asset-clear-slot/);
  assert.match(js, /await setEquipment\('main',type\.equipment\)/);
  assert.match(js, /\$\{type\.label\}を装備しました/);
  assert.doesNotMatch(js, /setFocusPreset\('main'\)/);
  assert.doesNotMatch(js, /data-asset-slot[^\n]+setFocusPreset/);
  for (const label of ['素手','剣','斧','杖','クロスボウ']) assert.match(js, new RegExp(`label:'${label}'`));
  assert.match(css, /\.asset-weapon-types\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
});

test('equipment review preserves camera unless the user chooses a camera preset', async () => {
  const [html, js] = await Promise.all([readFile(htmlUrl,'utf8'),readFile(jsUrl,'utf8')]);
  assert.match(html, /data-asset-camera="front"/);
  assert.match(js, /button\.dataset\.assetCamera/);
  assert.doesNotMatch(js, /selectWeaponType[\s\S]{0,700}setFocusPreset/);
  assert.doesNotMatch(js, /\[data-asset-slot\][\s\S]{0,240}setFocusPreset/);
});

test('equipment slots are status-only and preview remains character-first on phones', async () => {
  const [html, css, js] = await Promise.all([
    readFile(htmlUrl,'utf8'), readFile(cssUrl,'utf8'), readFile(jsUrl,'utf8'),
  ]);
  assert.match(html, /asset-slot-statuses/);
  assert.doesNotMatch(html, /role="tab"|role="tablist"/);
  assert.match(js, /idle\|stand\|breath/);
  assert.match(css, /height:clamp\(470px,67dvh,700px\)/);
});


test('direct weapon selection uses protagonist native accessories before review-only fetch', async () => {
  const js = await readFile(jsUrl,'utf8');
  assert.match(js, /const nativeMounted = new Map\(\)/);
  assert.match(js, /const nativeName=slot!==['"]back['"]\?ACCESSORY_NODES\[spec\.family\]\?\.\[side\]:null/);
  assert.match(js, /native\.visible=true/);
  assert.match(js, /nativeMounted\.set\(slot,native\)/);
  const nativeReturn=js.indexOf('nativeMounted.set(slot,native)');
  const networkLoad=js.indexOf('loader.loadAsync(reviewEquipmentUrl(spec))');
  assert.ok(nativeReturn>=0 && networkLoad>nativeReturn);
  for (const family of ['1H_Sword','1H_Axe','2H_Staff','2H_Crossbow']) assert.ok(js.includes(family));
});
