import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

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
  assert.match(js, /const equip=\(\)=>setEquipment\('main',type\.equipment\)/);
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


test('direct weapon selection preloads materialized assets and reuses them on swap', async () => {
  const [html,js] = await Promise.all([readFile(htmlUrl,'utf8'),readFile(jsUrl,'utf8')]);
  assert.match(html,/id="asset-stage-loading"/);
  assert.match(js,/const equipmentCache = new Map\(\)/);
  assert.match(js,/async function prepareWeaponLibrary\(\)/);
  assert.match(js,/renderer\.compileAsync|renderer\.compile\(scene,camera\)/);
  assert.match(js,/const payload=await prepareEquipment\(slot,spec\)/);
  assert.doesNotMatch(js,/async function setEquipment[\s\S]{0,900}loader\.loadAsync\(reviewEquipmentUrl\(spec\)\)/);
  assert.match(js,/loader\.loadAsync\(reviewEquipmentUrl\(spec\)\)/);
  for (const file of ['Skeleton_Blade','Skeleton_Axe','Skeleton_Staff','Skeleton_Crossbow']) {
    const gltf=new URL(`../public/asset-review/equipment/${file}.gltf`,import.meta.url);
    const bin=new URL(`../public/asset-review/equipment/${file}.bin`,import.meta.url);
    assert.ok((await stat(gltf)).size>0,`${file}.gltf must be materialized`);
    assert.ok((await stat(bin)).size>0,`${file}.bin must be materialized`);
  }
  assert.ok((await stat(new URL('../public/asset-review/equipment/skeleton_texture.png',import.meta.url))).size>0);
});


test('held weapons use the protagonist hand sockets instead of skeleton-model grip offsets', async () => {
  const js=await readFile(jsUrl,'utf8');
  assert.match(js,/function dedicatedHandSlot\(anchor,slot\)/);
  assert.match(js,/handslot\.l/);
  assert.match(js,/handslot\.r/);
  assert.match(js,/if\(dedicatedHandSlot\(anchor,slot\)\)\{[\s\S]*fitObject\(payload,spec\.targetFraction,characterHeight\);[\s\S]*return;/);
  assert.match(js,/const characterHeight=modelHeight\(\);[\s\S]*anchor\.add\(payload\);[\s\S]*applyTransform\(payload,spec,slot,anchor,characterHeight\)/);
});
