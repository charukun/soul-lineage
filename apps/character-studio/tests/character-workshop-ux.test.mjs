import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ux = read('../src/character-workshop-ux.js');
const loading = read('../src/character-workshop-loading-indicator.js');
const css = read('../src/character-workshop-ux.css');
const entry = read('../src/motion-review-entrypoint.js');
const slotAuto = read('../src/review-slot-auto.js');
const slotPicker = read('../src/review-slot-picker.js');
const slotCss = read('../src/review-slot-picker.css');
const motionQA = read('../src/character-motion-qa.js');
const characterGrid = read('../src/character-review-grid.js');
const characterGridCss = read('../src/character-review-grid.css');

test('workshop exposes only three primary mobile intentions', () => {
  for (const [key,label] of [['build','作る'],['move','動かす'],['compare','比べる']]) {
    assert.match(ux, new RegExp(`${key}: \\{ label: '${label}'`));
  }
  assert.match(ux, /nav\.replaceChildren\(\)/);
  assert.match(ux, /workshop-secondary-tabs/);
  assert.match(ux, /dataset\.workshopIntent/);
});

test('simple primary navigation no longer waits for optional motion QA controls', () => {
  assert.match(ux, /function installCore\(\)/);
  assert.match(ux, /!window\.characterStudio \|\| !qs\('\.mode-tabs'\) \|\| !qs\('\.review-controls'\)/);
  assert.match(ux, /function installOptionalTools\(\)/);
  assert.ok(ux.indexOf('buildIntentNavigation();') < ux.indexOf('installOptionalTools();'));
});

test('loading state is visible on the stage and reflects the real renderer progress', () => {
  assert.match(ux, /installWorkshopLoadingIndicator/);
  for (const id of ['load-indicator','load-label','load-percent','load-fill','load-detail']) assert.match(loading, new RegExp(`\\.id = '${id}'`));
  for (const phase of ['モデル本体','骨格・動き','表示データ','GPU準備']) assert.match(loading, new RegExp(phase));
  assert.match(loading, /Number\(progress\.value\)/);
  assert.match(loading, /status\.textContent/);
  assert.match(loading, /performance\.now\(\)/);
  assert.match(css, /\.load-indicator\{/);
  assert.match(css, /\.load-indicator-track/);
});

test('motion comparison and diagnostics are opt-in instead of covering the stage', () => {
  assert.match(ux, /qa-live-toggle/);
  assert.match(ux, /getAttribute\('aria-pressed'\) === 'true'/);
  assert.match(ux, /live\.click\(\)/);
  assert.match(ux, /motionDebug = 'off'/);
  assert.match(ux, /qa-debug-toggle/);
  assert.match(ux, /workshop-qa-details/);
  assert.match(css, /html:not\(\[data-motion-debug="on"\]\) #motion-debug-overlay/);
});

test('mobile stage remains dominant and edit footer leaves review modes', () => {
  assert.match(css, /grid-template-rows:minmax\(0,64fr\) minmax\(0,36fr\)/);
  assert.match(css, /data-workshop-intent="move"\] \.editor-footer/);
  assert.match(css, /data-workshop-intent="compare"\] \.editor-footer/);
  assert.match(css, /\.stage-actions\{grid-template-columns:repeat\(3/);
});

test('Visual Review gets dedicated simple character and motion modes', () => {
  assert.match(entry, /const REVIEW_MODES = Object\.freeze/);
  assert.match(entry, /character: \{/);
  assert.match(entry, /キャラクターモデル確認/);
  assert.match(entry, /motion: \{/);
  assert.match(entry, /dataset\.reviewMode = mode/);
  assert.match(entry, /simple-review-summary/);
  assert.match(entry, /simple-review-subject/);
  assert.match(entry, /prepareCharacterCameraStrip/);
  assert.match(entry, /moveCameraControlsToStage/);
  assert.match(entry, /if \(alias && button\.textContent !== alias\) button\.textContent = alias/);
  assert.doesNotMatch(entry, /if \(alias\) button\.textContent = alias/);
  assert.doesNotMatch(entry, /simple-review-guide/);
  assert.doesNotMatch(entry, /simple-review-badge/);
  assert.match(css, /body\.simple-review \.mode-tabs/);
  assert.match(css, /\.simple-review-summary/);
  assert.match(css, /\.simple-review-subject/);
  assert.match(css, /data-review-mode="motion"/);
});

test('simple review keeps preview chrome quiet and controls compact', () => {
  assert.match(css, /body\.simple-review \.stage-status #status:not\(\[data-error="true"\]\)/);
  assert.match(css, /body\.simple-review \.stage-actions #frame-model/);
  assert.match(css, /body\[data-review-mode="character"\] #character-model-options/);
  assert.match(css, /body\.simple-review \.workshop-secondary-tabs/);
});

test('character model review exposes review axes and preserves the full selectable catalogue', () => {
  // Reconcile PR #970's three-slot prototype with the complete character-review catalogue.
  assert.match(slotAuto, /if\(mode==='character'\)\{installCharacterReviewGrid\(\);return;\}/);
  for (const selector of ['#character-model-options [data-character-model]', '#slot-tabs [data-slot]', '#part-options [data-modular-value]']) {
    assert.ok(characterGrid.includes(selector));
  }
  for (const id of ['model','individual','part','variant','age','hair','eyes','skin','dye']) {
    assert.ok(characterGrid.includes(`['${id}',`));
  }
  assert.doesNotMatch(characterGrid, /\['camera',/);
  assert.match(characterGrid, /const cameraButtons = \[\.\.\.doc\.querySelectorAll/);
  assert.match(characterGrid, /button\.dataset\.camera === state\.camera/);
  assert.match(characterGrid, /option\.source\.click\(\)/);
  assert.match(characterGrid, /const grid = make\('div', 'character-review-grid'\)/);
  assert.match(characterGridCss, /\.character-review-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(characterGridCss, /stage-actions > \[data-camera\]/);
  assert.match(characterGridCss, /border-radius:\s*999px/);
  assert.match(characterGridCss, /character-model-picker/);
  assert.match(characterGridCss, /character-model-list/);
  assert.doesNotMatch(characterGridCss, /grid-auto-flow:column/);
  assert.match(characterGridCss, /character-model-list\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(characterGridCss, /CHARACTER PROBE/);
  assert.match(characterGridCss, /minmax\(0,\s*56fr\).*minmax\(0,\s*44fr\)/);
  assert.match(characterGrid, /function optionMark\(group, option\)/);
  assert.match(characterGrid, /const DETAIL_GROUPS = GROUPS\.filter/);
  assert.match(characterGrid, /const REVIEW_CRITERIA = Object\.freeze/);
  assert.match(characterGrid, /const modelPicker = make\('section', 'character-model-picker'\)/);
  assert.match(characterGrid, /function renderModelOptions\(group\)/);
  assert.match(characterGrid, /state = \{ active: 'individual'/);
  for (const label of ['シルエット','干渉','顔','年齢差','個体差','ゲーム距離']) assert.ok(characterGrid.includes(label));
  assert.match(characterGrid, /const actionNodes = \['quality-mark'\]/);
  assert.doesNotMatch(characterGrid, /'別候補'/);
  assert.match(characterGrid, /button\.dataset\.reviewAction = id/);
  assert.match(characterGrid, /subjectRow\.classList\.add\('character-review-pager'\)/);
  assert.match(characterGrid, /frameButton\.textContent = '全身'/);
  assert.match(characterGrid, /button\.dataset\.group = group\.id/);
  assert.match(characterGridCss, /character-review-pager/);
  assert.match(characterGridCss, /data-group="model"/);
  assert.match(characterGridCss, /stage-actions #camera-cycle/);
  assert.match(characterGridCss, /#retry:disabled\{display:none!important\}/);
  assert.doesNotMatch(characterGrid, /↶ 戻す/);
  assert.doesNotMatch(characterGrid, /↷ やり直す/);
  assert.match(characterGrid, /canvasWrap\.append\(actions\)/);
  assert.match(characterGridCss, /load-indicator\[data-state="error"\]\{display:none!important\}/);
  assert.match(entry, /自動生成/);
  assert.doesNotMatch(slotAuto, /move\(mountReviewGroup\(byId\('character-model-options'\)/);
  // The shared reusable deck and its layout contracts from develop remain intact.
  assert.match(slotPicker, /export function mountReviewGroupDeck/);
  assert.match(slotPicker, /review-slot-deck-slots/);
  assert.match(slotPicker, /review-slot-deck-list/);
  assert.match(slotCss, /\.review-slot-deck-slots\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(slotCss, /\.review-slot-deck-list\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /data-review-mode="character"\] #panel-parts>\.panel-heading/);
});

test('motion review exposes one selected slot and a persistent five-column motion list', () => {
  assert.match(slotAuto, /mountReviewSelectGrid\(byId\('qa-motion'\),'選択中の動き'\)/);
  assert.doesNotMatch(slotAuto, /mountReviewSelect\(byId\('qa-motion'\)/);
  assert.match(slotAuto, /dataset\.reviewMode==='motion'/);
  assert.doesNotMatch(slotAuto, /mountReviewGroup\(byId\('qa-cameras'\),'角度'\)/);
  assert.match(slotPicker, /export function mountReviewSelectGrid/);
  assert.match(slotPicker, /review-select-grid-current/);
  assert.match(slotPicker, /review-candidate-label/);
  assert.match(slotPicker, /review-select-grid-list/);
  assert.match(slotCss, /\.review-select-grid-list\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(motionQA, /motionChanged=motion\.value!==row\.id/);
  assert.match(motionQA, /motion\.dispatchEvent\(new Event\('input'/);
});

test('shared review selection cards are visually distinct from five-column candidate tiles', () => {
  assert.match(slotCss, /\.review-slot-trigger\{[^}]*linear-gradient/);
  assert.match(slotCss, /\.review-slot-trigger\{[^}]*box-shadow:inset 3px 0/);
  assert.match(slotCss, /\.review-slot-option\{[^}]*background:#101614/);
  assert.match(slotCss, /\.review-slot-option\[aria-selected="true"\]\{[^}]*inset 0 -2px/);
  assert.match(slotCss, /\.review-select-grid-current\{[^}]*min-height:54px/);
  assert.match(slotCss, /\.review-candidate-label\{/);
  assert.match(slotCss, /\.review-slot-deck-list-label\{/);
});

test('restored UX is loaded by the existing workshop entry without adding authority', () => {
  assert.match(entry, /import '\.\/character-workshop-ux\.js'/);
  for (const code of [ux, entry]) {
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection/);
    assert.doesNotMatch(code, /fetch\(|gameState|saveGame/);
  }
});
