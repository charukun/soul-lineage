import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const code = read('review/character/grid.js');
const css = read('review/character/grid.css');
const main = read('review/character/main.js');
const review = read('review/character/runtime.js');
const { readCharacterModels, gridFocusIndex, installCharacterReviewGrid } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace("import './grid.css';", '').replace("import { createReviewSvgThumbnail } from '@soul/shared-ui/review-thumbnail';", 'const createReviewSvgThumbnail = () => null;')).toString('base64')}`
);

function source(label, { id='model', pressed=false, disabled=false, stage='PRIMARY' } = {}) {
  return {
    textContent: label,
    dataset: { characterModel:id, modelStage:stage, reviewLabel:'', thumbnailUrl:'', thumbnailKind:'' },
    isConnected:true,
    getAttribute:name => name === 'aria-pressed' ? String(pressed) : null,
    matches:selector => selector === ':disabled' && disabled
  };
}

test('simple character review exposes real models with a compact visual catalog', () => {
  assert.match(main, /const simpleReview = document\.body\.classList\.contains\('simple-review'\)/);
  assert.match(main, /if \(!simpleReview\) \{\s*const generated = button\('量産モデル'/);
  assert.match(main, /主人公 男/);
  assert.match(main, /主人公 女/);
  assert.match(main, /dataset\.reviewLabel = concise/);
  assert.match(main, /protagonist-villager-v1\.png/);
  assert.match(main, /protagonist-villager-female-v1\.png/);
  assert.match(main, /model\.legacyVersion \? 'svg-symbol' : 'image'/);
  assert.match(code, /createReviewSvgThumbnail/);
  assert.match(code, /model\.thumbnailKind === 'svg-symbol'/);
  assert.match(main, /KAYKIT_MODELS/);
  for (const label of ['騎士','蛮族','魔術師','盗賊','フード盗賊']) assert.match(main, new RegExp(label));
  assert.doesNotMatch(code, /character-model-card-stage/);
  assert.doesNotMatch(code, /実モデルのみ/);
  assert.doesNotMatch(code, /要修正|reviewDecision|modelVerdicts|詳細確認|stepModel/);
});

test('model catalog remains a six-column review grid on phone and desktop', () => {
  assert.match(css, /\.character-model-grid\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.character-model-grid\{[\s\S]*?repeat\(6,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /38%|62%/);
  assert.match(css, /grid-template-rows:minmax\(270px,1fr\) auto!important/);
});

test('camera controls are split into compact stage-local groups and utility actions stay on the stage', () => {
  assert.match(code, /character-review-camera-dock review-surface__stage-tools/);
  assert.match(code, /directionGroup\.append\(button\)/);
  assert.match(code, /focusGroup\.append\(frameButton\)/);
  assert.match(code, /character-review-stage-utility/);
  assert.match(code, /capture\.classList\.add\('character-review-capture'\)/);
  assert.match(css, /character-review-camera-dock[\s\S]*?justify-content:space-between/);
  assert.match(css, /character-review-camera-group[\s\S]*?border-radius:999px/);
});

test('shared settings affordance exposes age and body controls without burying them below the catalog', () => {
  assert.match(code, /dataset\.sharedIcon = 'settings-2'/);
  assert.match(css, /packages\/assets\/src\/icons\/lucide\/settings-2\.svg/);
  assert.match(code, /キャラクター調整/);
  assert.match(code, /advanced\.html#age/);
  assert.match(code, /advanced\.html#gene-height/);
  assert.match(code, /advanced\.html#gene-build/);
  assert.match(code, /advanced\.html#gene-hair/);
  assert.match(code, /settingsDialog\.showModal/);
  assert.doesNotMatch(code, /character-review-advanced/);
});

test('model source selection is the single writer and first real model becomes the initial simple-review target', () => {
  assert.match(code, /model\.source\.click\(\)/);
  assert.match(code, /!review\(\)\?\.displayModelId/);
  assert.match(code, /autoSelected = true/);
  const models = readCharacterModels({querySelectorAll:()=>[
    source('主人公 男',{id:'protagonist.villager.v1',pressed:true}),
    source('主人公 女',{id:'protagonist.villager.female.v1'})
  ]}, true);
  assert.deepEqual(models.map(x=>[x.key,x.label,x.selected]), [
    ['protagonist.villager.v1','主人公 男',true],
    ['protagonist.villager.female.v1','主人公 女',false]
  ]);
});

test('keyboard navigation keeps six-column geometry', () => {
  const items=Array.from({length:10},()=>({disabled:false}));
  assert.equal(gridFocusIndex(items,1,'ArrowDown'),7);
  assert.equal(gridFocusIndex(items,7,'ArrowUp'),1);
});

test('simple installer stays character-only and idempotent', () => {
  assert.equal(installCharacterReviewGrid({ body:{ classList:{contains:()=>false}, dataset:{reviewMode:'character'} } }, {}), false);
});

test('protagonist sources are committed in app or shared Asset Origin and loading is integrity checked', () => {
  for (const file of [
    '../public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb',
    '../public/simulator/assets/PROTAGONIST_VILLAGER_V1.asset.json',
    '../../review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb',
    '../public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json'
  ]) assert.ok(statSync(new URL(file, import.meta.url)).size > 0, file);
  assert.match(review, /loadFoundationModel/);
  assert.match(review, /model\.source\.gitBlobSha/);
  assert.match(review, /model\.runtime\.url/);
  assert.match(review, /model\.integrityPath/);
  assert.match(review, /model\.assetPath/);
  assert.match(review, /cache: 'no-store'/);
  assert.match(review, /assetUrl\.searchParams\.set\('sha256', receipt\.sha256\)/);
  assert.match(review, /modelBytes\(assetUrl\.href, \{ cache: 'no-store' \}\)/);
  assert.match(review, /receipt\.sha256 !== sha256/);
  assert.match(review, /kaykit\.Rig_Medium\.v1/);
  assert.doesNotMatch(review, /旧carrier rig依存のため退役中/);
});

test('simple review uses the shared raw-model framing path without generated body scaling', () => {
  assert.match(review, /createReviewRenderer/);
  assert.match(review, /positionReviewCamera/);
  assert.match(review, /simpleModelReview/);
  assert.match(review, /img2threejs\?1\.14:proceduralRoot\?1\.4:1\.08/);
  assert.match(review, /if \(!simpleModelReview\) actors\.forEach/);
  assert.match(review, /if \(!simpleModelReview && schedules\[i\]\.advance/);
});
