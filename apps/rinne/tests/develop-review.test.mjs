import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(appRoot,path),'utf8');

test('Visual Review launcher is only five direct destinations',async()=>{
  const html=await read('review.html');
  for(const [target,href] of [['characters','./characters.html?review=character'],['motion','./review-motion.html'],['assets','./review-assets.html'],['effects','./review-effects.html'],['battle','./review-battle.html']]){
    assert.match(html,new RegExp(`data-review-target="${target}"[^>]*href="${href.replace(/[.?]/g,'\\$&')}"`));
  }
  assert.equal((html.match(/data-review-target=/g)||[]).length,5);
  assert.doesNotMatch(html,/<iframe\b/);
  assert.doesNotMatch(html,/develop-review\.js/);
  assert.doesNotMatch(html,/focus-shell|app-context|対象・正本/);
});

test('motion review uses the pinned KayKit GLB clips with real mixer controls',async()=>{
  const [html,js]=await Promise.all([read('review-motion.html'),read('src/review-motion.js')]);
  assert.match(html,/id="motion-stage"/);assert.match(html,/id="motion-grid"/);assert.match(html,/id="motion-time"/);
  assert.match(js,/new THREE\.AnimationMixer/);assert.match(js,/KAYKIT_MODELS/);assert.match(js,/buildMotionReviewCatalog/);
  assert.match(js,/1\/60/);assert.match(js,/LoopRepeat/);assert.match(js,/dataset\.motionSource='kaykit-embedded'/);
});

test('equipment review uses the same quiet preview and compact camera hierarchy',async()=>{
  const [html,css,js]=await Promise.all([read('review-assets.html'),read('src/review-asset-library.css'),read('src/review-asset-library.js')]);
  assert.match(html,/class="asset-topbar"/);
  assert.match(html,/id="asset-camera-strip"/);
  for(const preset of ['front','side','back','full'])assert.match(html,new RegExp(`data-asset-camera="${preset}"`));
  assert.doesNotMatch(html,/asset-badge|asset-help|asset-step/);
  assert.match(js,/function setCameraPreset/);
  assert.match(js,/controls\.addEventListener\('start'/);
  assert.match(css,/grid-template-rows:42px minmax\(0,58fr\) minmax\(0,42fr\)/);
  assert.match(css,/\.asset-camera-strip button\{min-height:26px/);
});

test('Battle is a dedicated page using real RaidHost and runtime models',async()=>{
  const [html,review,battle]=await Promise.all([read('review-battle.html'),read('src/review-battle.js'),read('src/review-battle-stage.js')]);
  assert.match(html,/id="battle-canvas"/);assert.match(html,/id="battle-hero-model"/);assert.match(html,/id="battle-enemy-model"/);
  assert.match(html,/<a href="\/" aria-label="Visual Reviewへ戻る">‹ 戻る<\/a>/);
  assert.match(html,/\.model-status,\.note,\.pickers,\.review-modes,\.actions button:last-child\{display:none!important\}/);
  assert.match(html,/<span>Rogue<\/span>/);assert.match(html,/<span>Knight<\/span>/);
  assert.match(review,/const loopEnabled=true,followCamera=true;/);
  assert.doesNotMatch(review,/battle-loop'\)\.addEventListener|battle-camera'\)\.addEventListener/);
  assert.match(review,/from '@soul\/network\/raid-host'/);assert.match(review,/new RaidHost/);assert.match(review,/createReviewBattleStage/);
  assert.match(review,/stage\.setModel\('hero'/);assert.match(review,/stage\.setModel\('enemy'/);
  assert.match(battle,/createKaykitCharacterPools/);assert.match(battle,/tidebreakFrameFromSnapshot/);assert.match(battle,/applyTidebreakPose/);assert.match(battle,/battleGeometry='runtime-models'/);
});

test('authored effect review reuses the runtime effect player and backend',async()=>{
  const js=await read('src/review-effects.js');
  assert.match(js,/createAuthoredEffectPlayer/);assert.match(js,/createEffekseerBackend/);assert.match(js,/authoredEffectBase/);assert.match(js,/combatEffectBudget/);
});

test('RINNE build includes launcher, VFX and battle review entries',async()=>{
  const vite=await read('vite.config.js');
  assert.match(vite,/review:fileURLToPath\(new URL\('\.\/review\.html'/);
  assert.match(vite,/reviewMotion:fileURLToPath/);
  assert.match(vite,/reviewEffects:fileURLToPath\(new URL\('\.\/review-effects\.html'/);
  assert.match(vite,/reviewBattle:fileURLToPath\(new URL\('\.\/review-battle\.html'/);
});


test('Review preloader never serves cached navigation documents',async()=>{
  const sw=await read('public/review-preload-sw.js');
  assert.match(sw,/fetch\(routeUrl, \{cache: 'no-store', credentials: 'same-origin'\}\)/);
  assert.doesNotMatch(sw,/const documentPayload = await fetchPayload\(routeUrl\)/);
});
