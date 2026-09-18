import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const gameplay=readFileSync(join(here,'../src/gameplay-ui.js'),'utf8');
const loadout=readFileSync(join(here,'../src/heart-technique-body-ui.js'),'utf8');
const css=readFileSync(join(here,'../src/heart-technique-body.css'),'utf8');

test('bottom rail exposes independent heart technique body pages',()=>{
  assert.match(gameplay,/data-heart/);assert.match(gameplay,/data-techniques/);assert.match(gameplay,/data-body/);assert.match(gameplay,/>心</);assert.match(gameplay,/>技</);assert.match(gameplay,/>体</);
  assert.match(loadout,/renderHeart/);assert.match(loadout,/renderTechnique/);assert.match(loadout,/renderBody/);
});

test('body command and loadout panel body resolve to different DOM targets',()=>{
  assert.match(gameplay,/panel=q\('\[data-panel\]'\)/);
  assert.match(gameplay,/bodyButton:q\('\.rinne-bottom-controls \[data-body\]'\)/);
  assert.match(gameplay,/body:panel\.querySelector\('\[data-body\]'\)/);
  assert.doesNotMatch(gameplay,/bodyButton:q\('\[data-body\]'\).*body:q\('\[data-body\]'\)/s);
});

test('technique page models combos, favored tags, and a costly manual one-motion',()=>{
  assert.match(loadout,/addCombo/);assert.match(loadout,/toggleFavored/);assert.match(loadout,/得意技/);assert.match(loadout,/手動奥義/);assert.match(loadout,/消耗と隙が大きい/);
  assert.match(gameplay,/data-one-motion/);assert.match(gameplay,/消耗大 \/ 隙大/);
});

test('body page has stance style and zanshin as the same three-slot grammar',()=>{
  assert.match(loadout,/構え/);assert.match(loadout,/戦法/);assert.match(loadout,/残心/);assert.match(loadout,/unlockedBodyOptions/);assert.match(loadout,/loadout-slot-row/);assert.match(loadout,/loadout-grid/);
});

test('heart technique body use ten-item pages that render as two rows of a five-column library',()=>{
  assert.match(loadout,/GRID_PAGE_SIZE=10/);assert.match(loadout,/HEART_SLOT_COUNT/);assert.match(loadout,/setHeartSlot/);assert.match(loadout,/得意技/);assert.match(loadout,/手動奥義/);
});

test('mobile loadout remains tactile and avoids glass-card fallback',()=>{
  assert.match(css,/clip-path:polygon/);assert.match(css,/box-shadow:inset/);assert.match(css,/repeating-linear-gradient/);assert.match(css,/env\(safe-area-inset-bottom\)/);assert.match(css,/@media\(max-width:410px\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/backdrop-filter/);
  assert.match(css,/\.one-motion-control\{[^}]*min-height:58px/s);assert.match(css,/\.combo-slot\{[^}]*min-height:68px/s);
});
