import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(appRoot,path),'utf8');

test('legacy RINNE review entry bridges to the independent Visual Review Lab',async()=>{
  const [bridge,lab,routes]=await Promise.all([read('review.html'),read('../review/index.html'),read('../review/src/main.js')]);
  assert.match(bridge,/data-review-bridge/);
  assert.match(bridge,/soul-lineage-review-dev\.c-okamoto\.workers\.dev/);
  assert.doesNotMatch(bridge,/data-review-target=/);
  assert.doesNotMatch(bridge,/<iframe\b/);
  assert.match(lab,/data-dev-tool="visual-review"/);
  for(const target of ['characters','motion','equipment','objects','effects','battle'])assert.match(lab,new RegExp(`data-route="${target}"`));
  assert.doesNotMatch(lab,/<b>装備・物体<\/b>/);
  assert.match(routes,/characters:DEV\.characters/);
  assert.match(routes,/soul-lineage-character-studio-dev\.c-okamoto\.workers\.dev/);
  assert.match(routes,/motion:route\(DEV\.rinne,'review-motion\.html'\)/);
  assert.match(routes,/equipment:route\(DEV\.rinne,'review-assets\.html'\)/);
  assert.match(routes,/objects:route\(DEV\.rinne,'review-objects\.html'\)/);
  assert.match(routes,/effects:route\(DEV\.rinne,'review-effects\.html'\)/);
  assert.match(routes,/battle:route\(DEV\.rinne,'review-battle\.html'\)/);
});

test('all specialist review pages expose one Visual Review Lab back route',async()=>{
  const pages=await Promise.all(['review-motion.html','review-assets.html','review-objects.html','review-effects.html','review-sound.html','review-battle.html'].map(read));
  for(const html of pages){
    const matches=html.match(/href="https:\/\/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/"[^>]*aria-label="Visual Reviewへ戻る"/g)||[];
    assert.equal(matches.length,1);
  }
  assert.ok(pages[0].indexOf('motion-controls')<pages[0].indexOf('motion-back'));
  assert.match(pages[3],/class="review-title"[^>]*>\s*<a class="review-lab-back"/);
  assert.match(pages[4],/class="review-title"[^>]*>\s*<a class="review-lab-back"/);
});

test('motion review uses the pinned KayKit GLB clips with real mixer controls',async()=>{
  const [html,js,css]=await Promise.all([read('review-motion.html'),read('src/review-motion.js'),read('src/review-motion.css')]);
  assert.match(html,/id="motion-stage"/);assert.match(html,/id="motion-grid"/);assert.match(html,/id="motion-time"/);
  assert.match(html,/class="motion-current-label">選択中の動き/);
  assert.match(html,/class="motion-grid-title">候補一覧/);
  assert.match(css,/\.motion-stage-slot\{[^}]*box-shadow:inset 3px 0/);
  assert.match(css,/\.motion-grid button\{[^}]*background:#101614/);
  assert.match(css,/\.motion-grid button\[aria-pressed="true"\]\{[^}]*inset 0 -2px/);
  assert.match(css,/\.motion-camera-strip button\{[^}]*border-radius:999px/);
  assert.match(js,/new THREE\.AnimationMixer/);assert.match(js,/KAYKIT_MODELS/);assert.match(js,/buildMotionReviewCatalog/);
  assert.match(js,/1\/60/);assert.match(js,/LoopRepeat/);assert.match(js,/dataset\.motionSource='kaykit-embedded'/);
});

test('equipment review is organized around equipment fit and inspection tasks',async()=>{
  const [html,css,js]=await Promise.all([read('review-assets.html'),read('src/review-asset-library.css'),read('src/review-asset-library.js')]);
  assert.match(html,/装備確認 \\| 百年転生/);
  assert.match(html,/data-review-back[^>]*href="https:\/\/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/"/);
  assert.match(html,/id="asset-review-points"/);
  for(const point of ['装着位置','干渉','尺度','裏側'])assert.match(html,new RegExp(point));
  assert.match(html,/id="asset-slot-tabs"/);
  assert.match(html,/id="asset-equipment-options"/);
  for(const preset of ['front','side','back'])assert.match(html,new RegExp(`data-asset-camera="${preset}"`));
  for(const focus of ['full','main','off','back'])assert.match(html,new RegExp(`data-asset-focus="${focus}"`));
  assert.doesNotMatch(html,/review-slot-auto\.js|着せ替え確認/);
  assert.match(js,/function setFocusPreset/);
  assert.match(js,/function renderEquipmentInspector/);
  assert.match(css,/\.asset-back\{/);
  assert.match(css,/grid-template-rows:50px minmax\(320px,55dvh\) minmax\(0,1fr\)/);
  assert.match(css,/\.asset-slot-tabs\{display:grid;grid-template-columns:repeat\(3/);
  assert.match(css,/\.asset-equipment-options\{display:grid;grid-template-columns:repeat\(2/);
});

test('world-object review loads the exact RINNE runtime props independently of equipment',async()=>{
  const [html,css,js]=await Promise.all([read('review-objects.html'),read('src/review-object-library.css'),read('src/review-object-library.js')]);
  assert.match(html,/物体確認 \\| 百年転生/);
  assert.match(html,/id="object-stage"/);
  assert.match(html,/id="object-options"/);
  for(const preset of ['front','side','top','full'])assert.match(html,new RegExp(`data-object-camera="${preset}"`));
  for(const asset of ['barrel_small.gltf.glb','box_small.gltf.glb','rubble_large.gltf.glb','torch_lit.gltf.glb'])assert.match(js,new RegExp(asset.replaceAll('.','\\.')));
  assert.match(js,/new GLTFLoader/);
  assert.match(js,/RINNE runtime asset/);
  assert.match(css,/\.object-options button\[aria-pressed="true"\]/);
});

test('Battle review exposes model and encounter switching and shares live combat camera contracts',async()=>{
  const [html,review,battle,slots]=await Promise.all([read('review-battle.html'),read('src/review-battle.js'),read('src/review-battle-stage.js'),read('src/review-slot-auto.js')]);
  assert.match(html,/id="battle-canvas"/);assert.match(html,/id="battle-hero-model"/);assert.match(html,/id="battle-enemy-model"/);
  assert.match(html,/data-battle-mode="duel"/);assert.match(html,/data-battle-mode="melee"/);assert.doesNotMatch(html,/id="battle-toggle"/);
  assert.match(html,/href="https:\/\/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/"[^>]*aria-label="Visual Reviewへ戻る"/);
  assert.match(html,/\.model-status,\.note\{display:none!important\}/);
  assert.match(review,/const loopEnabled=true,followCamera=true;/);assert.match(review,/encounterMode='duel'/);assert.match(review,/cameraSystem='rinne'/);
  assert.match(review,/stage\.setModel\('hero'/);assert.match(review,/stage\.setModel\('enemy'/);assert.match(review,/setEncounterMode/);
  assert.match(battle,/createKaykitCharacterPools/);assert.match(battle,/ReviewBattleExtra/);assert.match(battle,/encounterMode==='melee'/);assert.match(battle,/reviewBattleCameraFrame/);
  assert.match(slots,/battle-enemy-model/);assert.match(slots,/battle-mode-switch/);
});

test('authored effect review reuses the runtime effect player and backend',async()=>{
  const js=await read('src/review-effects.js');
  assert.match(js,/createAuthoredEffectPlayer/);assert.match(js,/createEffekseerBackend/);assert.match(js,/authoredEffectBase/);assert.match(js,/combatEffectBudget/);
});

test('RINNE build includes launcher and every specialist review entry',async()=>{
  const vite=await read('vite.config.js');
  assert.match(vite,/review:fileURLToPath\(new URL\('\.\/review\.html'/);
  assert.match(vite,/reviewMotion:fileURLToPath/);
  assert.match(vite,/reviewAssets:fileURLToPath\(new URL\('\.\/review-assets\.html'/);
  assert.match(vite,/reviewObjects:fileURLToPath\(new URL\('\.\/review-objects\.html'/);
  assert.match(vite,/reviewEffects:fileURLToPath\(new URL\('\.\/review-effects\.html'/);
  assert.match(vite,/reviewBattle:fileURLToPath\(new URL\('\.\/review-battle\.html'/);
});


test('independent Visual Review Lab links directly to live DEV probes without an embedded shell',async()=>{
  const [lab,routes]=await Promise.all([read('../review/index.html'),read('../review/src/main.js')]);
  assert.doesNotMatch(lab,/<iframe\b/);
  assert.doesNotMatch(routes,/serviceWorker|review-preload-sw/);
  assert.match(routes,/const ROUTES=Object\.freeze/);
  assert.match(routes,/link\.href=href/);
  assert.match(routes,/link\.rel='noopener'/);
});
