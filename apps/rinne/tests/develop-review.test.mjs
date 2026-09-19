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
  for(const target of ['characters','motion','assets','effects','battle'])assert.match(lab,new RegExp(`data-route="${target}"`));
  assert.match(routes,/characters:route\(DEV\.rinne,'characters\.html\?review=character'\)/);
  assert.match(routes,/motion:route\(DEV\.rinne,'review-motion\.html'\)/);
  assert.match(routes,/assets:route\(DEV\.rinne,'review-assets\.html'\)/);
  assert.match(routes,/effects:route\(DEV\.rinne,'review-effects\.html'\)/);
  assert.match(routes,/battle:route\(DEV\.rinne,'review-battle\.html'\)/);
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
  assert.match(css,/\.asset-camera-strip button\{[^}]*border-radius:999px/);
  assert.match(css,/\.model-options button\[aria-pressed="true"\]\{[^}]*inset 0 -2px/);
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


test('independent Visual Review Lab links directly to live DEV probes without an embedded shell',async()=>{
  const [lab,routes]=await Promise.all([read('../review/index.html'),read('../review/src/main.js')]);
  assert.doesNotMatch(lab,/<iframe\b/);
  assert.doesNotMatch(routes,/serviceWorker|review-preload-sw/);
  assert.match(routes,/const ROUTES=Object\.freeze/);
  assert.match(routes,/link\.href=href/);
  assert.match(routes,/link\.rel='noopener'/);
});
