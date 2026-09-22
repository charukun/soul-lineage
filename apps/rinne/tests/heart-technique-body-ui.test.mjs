import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const source=path=>readFileSync(join(here,'../src',path),'utf8');
const gameplay=source('gameplay-ui.js'),heartUI=source('heart-technique-body-ui.js'),entry=source('inspiration-gameplay-ui.js'),journal=source('inspiration-journal-ui.js'),controls=source('inspiration-combat-controls.js'),css=source('inspiration-journal.css');
const sharedFour=readFileSync(join(here,'../../../packages/shared-ui/src/rinne-primary-four.js'),'utf8'),sharedMenu=readFileSync(join(here,'../../../packages/shared-ui/src/rinne-loadout-menu.js'),'utf8'),sharedMenuCss=readFileSync(join(here,'../../../packages/shared-ui/src/rinne-loadout-menu.css'),'utf8');

test('bottom rail retains independent heart technique body pages through the causal journal adapter',()=>{
  assert.match(gameplay,/rinnePrimaryFourMarkup/);for(const attr of ['data-heart','data-techniques','data-body','data-items'])assert.match(sharedFour,new RegExp(attr));assert.doesNotMatch(sharedFour,/<span>/);
  assert.match(entry,/installInspirationUI/);assert.match(entry,/installInspirationCombatControls/);assert.match(journal,/renderHeart/);assert.match(journal,/renderTechnique/);assert.match(journal,/renderBody/);
  assert.match(source('gameplay-upgrade.js'),/import \{ createGameplayUI \} from '\.\/inspiration-gameplay-ui\.js'/);
  // This app owns the presentation probe; the independent Lab tests only its routes.
  const battle=readFileSync(join(here,'../review-battle.html'),'utf8');
  assert.match(battle,/<title>技演出レビュー \| Visual Review<\/title>/);assert.match(battle,/id="battle-sound"/);assert.match(battle,/id="battle-canvas"/);assert.match(battle,/data-battle-mode="melee"/);assert.match(battle,/src="\.\/src\/review-battle.js"/);
});

test('body command and panel content remain distinct DOM targets',()=>{
  assert.match(gameplay,/panel=q\('\[data-panel\]'\)/);assert.match(gameplay,/bodyButton:q\('\.rinne-bottom-controls \[data-body\]'\)/);assert.match(gameplay,/body:panel\.querySelector\('\[data-body\]'\)/);assert.match(gameplay,/rinneLoadoutPanelMarkup/);assert.match(sharedMenu,/createRinneLoadoutSlot/);assert.match(heartUI,/createRinneLoadoutGridItem/);
  assert.doesNotMatch(gameplay,/bodyButton:q\('\[data-body\]'\).*body:q\('\[data-body\]'\)/s);
});

test('心技体装 uses three selection slots and six-column motion-style target grids',()=>{
  assert.match(sharedMenuCss,/\.loadout-slot-row[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(sharedMenuCss,/\.loadout-grid\{[\s\S]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);assert.match(sharedMenuCss,/aspect-ratio:1\/1!important/);
  assert.match(heartUI,/setHeartSlot/);assert.match(heartUI,/setPhaseSelection/);assert.match(heartUI,/phaseSelectionLabel/);assert.match(heartUI,/心得一覧/);assert.match(heartUI,/連技一覧/);assert.match(heartUI,/基本技一覧/);assert.match(heartUI,/GRID_PAGE_SIZE=12/);
});

test('journal preserves favored combos and the costly manual one-motion controls',()=>{
  assert.match(journal,/addCombo/);assert.match(journal,/removeCombo/);assert.match(controls,/toggleFavored/);assert.match(controls,/setOneMotion/);assert.match(controls,/得意技/);assert.match(controls,/手動奥義/);assert.match(controls,/消耗と隙が大きい/);
  assert.match(gameplay,/data-one-motion/);assert.match(gameplay,/消耗大 \/ 隙大/);assert.match(controls,/readonly/);assert.match(controls,/observer\.disconnect/);
});

test('body options retain stance souen and zanshin while showing individual bodily tendencies',()=>{
  assert.match(journal,/構え/);assert.match(journal,/葬焉/);assert.match(journal,/残心/);assert.doesNotMatch(journal,/戦法/);assert.match(journal,/unlockedBodyOptions/);assert.match(journal,/setBodyChoice/);assert.match(journal,/この身体の傾向/);assert.match(journal,/inspiration-mind-disc/);assert.match(journal,/conic-gradient/);
});

test('technique journal groups bounded families and exposes provenance rather than an unlock recipe grid',()=>{
  assert.match(journal,/const PAGE=5/);assert.match(journal,/inspiration-family/);assert.match(journal,/inspiration-technique-card/);assert.match(journal,/inspiration-provenance/);assert.match(journal,/renameInspiration/);assert.match(journal,/archiveInspiration/);
  assert.match(journal,/textContent/);assert.match(journal,/aria-live/);assert.doesNotMatch(journal,/GRID_PAGE_SIZE|loadout-grid|Math\.random\(/);assert.match(journal,/兆し/);assert.match(journal,/技譜/);
});

test('mobile journal remains readable, keyboard accessible, reduced-motion aware and not a glass-card UI',()=>{
  assert.match(css,/min-height:44px/);assert.match(css,/focus-visible/);assert.match(css,/env\(safe-area-inset-bottom/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/backdrop-filter:none/);assert.doesNotMatch(css,/backdrop-filter:blur/);
  assert.match(css,/overflow-wrap:anywhere/);assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/\.inspiration-reveal\[hidden\]\{display:none\}/);
});
