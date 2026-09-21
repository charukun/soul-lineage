import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const htmlUrl = new URL('../review-assets.html', import.meta.url);
const cssUrl = new URL('../src/review-asset-library.css', import.meta.url);
const jsUrl = new URL('../src/review-asset-library.js', import.meta.url);
const catalogUrl = new URL('../src/review-equipment-catalog.js', import.meta.url);

test('equipment review mirrors the motion library category-to-item flow', async () => {
  const [html,css,js,catalog] = await Promise.all([
    readFile(htmlUrl,'utf8'),readFile(cssUrl,'utf8'),readFile(jsUrl,'utf8'),readFile(catalogUrl,'utf8')
  ]);
  assert.match(html,/EQUIPMENT LIBRARY/);
  assert.match(html,/id="asset-filters"/);
  assert.match(html,/id="asset-grid-summary"/);
  assert.match(html,/id="asset-item-count"/);
  assert.match(js,/filterEquipmentReviewCatalog\(equipmentFilter\)/);
  assert.match(js,/REVIEW_EQUIPMENT_CATEGORY_ORDER/);
  assert.doesNotMatch(js,/const WEAPON_TYPES = Object\.freeze/);
  for(const label of ['おすすめ','刀剣','斧','長柄','遠距離','盾']) assert.match(catalog,new RegExp(label));
  assert.match(css,/\.asset-weapon-types\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
});

test('equipment catalog aggregates existing weapon sources instead of a fixed five-item list', async () => {
  const catalog=await readFile(catalogUrl,'utf8');
  assert.match(catalog,/REVIEW_SKELETON_EQUIPMENT/);
  assert.match(catalog,/RINNE_OBJECT_REVIEW_CATALOG/);
  assert.match(catalog,/kaykit-dagger/);
  assert.match(catalog,/kaykit-sword-1h/);
  assert.match(catalog,/kaykit-shield-badge/);
  assert.match(catalog,/item\.category==='weapons'/);
  assert.match(catalog,/spear\|staff\|槍\|杖/);
});

test('equipment review preserves camera unless the user chooses a camera preset', async () => {
  const [html, js] = await Promise.all([readFile(htmlUrl,'utf8'),readFile(jsUrl,'utf8')]);
  assert.match(html, /data-asset-camera="front"/);
  assert.match(js, /createReviewCameraPresetController/);
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
  assert.match(js,/const characterHeight=modelHeight\(\),payload=await prepareEquipment\(item\)/);
  assert.doesNotMatch(js,/async function setEquipment[\s\S]{0,900}loader\.loadAsync/);
  assert.match(js,/loader\.loadAsync\(new URL\(item\.url,location\.href\)\.href\)/);
  for (const file of ['Skeleton_Blade','Skeleton_Axe','Skeleton_Staff','Skeleton_Crossbow']) {
    const gltf=new URL(`../public/asset-review/equipment/${file}.gltf`,import.meta.url);
    const bin=new URL(`../public/asset-review/equipment/${file}.bin`,import.meta.url);
    assert.ok((await stat(gltf)).size>0,`${file}.gltf must be materialized`);
    assert.ok((await stat(bin)).size>0,`${file}.bin must be materialized`);
  }
  assert.ok((await stat(new URL('../public/asset-review/equipment/skeleton_texture.png',import.meta.url))).size>0);
});


test('catalog equipment follows protagonist hand sockets', async () => {
  const js=await readFile(jsUrl,'utf8');
  assert.match(js,/function dedicatedHandSlot\(anchor,slot\)/);
  assert.match(js,/handslot\.l/);
  assert.match(js,/handslot\.r/);
  assert.match(js,/const characterHeight=modelHeight\(\),payload=await prepareEquipment\(item\);[\s\S]*anchor\.add\(payload\);[\s\S]*applyTransform\(payload,item,slot,anchor,characterHeight\)/);
});


test('equipment preview uses reviewed humanoid idle stance and padded FOV-aware camera framing', async () => {
  const js=await readFile(jsUrl,'utf8');
  assert.match(js,/import \{applyReviewCombatMotion\} from '\.\/review-battle-hero-motion\.js'/);
  assert.match(js,/applyReviewCombatMotion\(presentationBones\(root\),\{attack:''\},\{stage:'idle'\},0\)/);
  assert.doesNotMatch(js,/rightUpper\.rotation\.z-=Math\.PI\*\.30|leftUpper\.rotation\.z\+=Math\.PI\*\.30/);
  assert.match(js,/function fullViewDistance\(frame,direction=activeViewDirection\)/);
  assert.match(js,/THREE\.MathUtils\.degToRad\(camera\.fov\*\.5\)/);
  assert.match(js,/return Math\.max\(vertical,horizontal\)\*1\.34/);
  assert.doesNotMatch(js,/radius\*1\.48|height\*\.74/);
  assert.match(js,/find\(clip=>\/idle\|stand\|breath\/i\.test/);
  assert.doesNotMatch(js,/find\(clip=>!\/t\[-_ \]\?pose/);
});


test('equipment review hides embedded combat props and applies calibrated hand grips', async () => {
  const [js,catalog]=await Promise.all([readFile(jsUrl,'utf8'),readFile(catalogUrl,'utf8')]);
  assert.match(js,/import \{hideEmbeddedCombatProps\} from '\.\/review-battle-equipment\.js'/);
  assert.match(js,/hideEmbeddedCombatProps\(root\)/);
  assert.match(js,/if\(slot==='main'\)return findNode\(modelRoot,'hand\.r'\)[\s\S]*findNode\(modelRoot,'handslot\.r'\)/);
  assert.match(js,/if\(slot==='off'\)return findNode\(modelRoot,'hand\.l'\)[\s\S]*findNode\(modelRoot,'handslot\.l'\)/);
  assert.match(js,/item\.grip/);
  assert.match(catalog,/const SKELETON_HAND_GRIPS/);
  assert.match(catalog,/1H_Sword/);
  assert.match(catalog,/2H_Crossbow/);
  assert.match(catalog,/rotation:Object\.freeze\(\[0,0,-Math\.PI\/2\]\)/);
});


test('equipment library exposes armor categories and body slots', async () => {
  const [html,js,catalog]=await Promise.all([readFile(htmlUrl,'utf8'),readFile(jsUrl,'utf8'),readFile(catalogUrl,'utf8')]);
  for(const id of ['head','body','arms','legs','back'])assert.match(html,new RegExp(`asset-current-${id}`));
  for(const [key,label] of [['head','頭'],['body','胴'],['arms','腕'],['legs','脚'],['back','背中']])assert.match(catalog,new RegExp(`${key}:'${label}'`));
  for(const armor of ['helmet','chestplate','bracers','greaves','mantle'])assert.match(catalog,new RegExp(`'${armor}'`));
  assert.match(js,/const EQUIPMENT_SLOTS=Object\.freeze\(\['main','off','head','body','arms','legs','back'\]\)/);
  assert.match(js,/function runtimeArmor\(item\)/);
  assert.ok(js.includes('lowerarm.'+'${'+'side}'));
  assert.ok(js.includes('lowerleg.'+'${'+'side}'));
  assert.match(js,/attachArmorRoots\(roots,characterHeight\)/);
});
