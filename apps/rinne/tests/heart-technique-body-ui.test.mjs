import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const gameplay=readFileSync(join(here,'../src/gameplay-ui.js'),'utf8');
const loadout=readFileSync(join(here,'../src/heart-technique-body-ui.js'),'utf8');
const css=readFileSync(join(here,'../src/heart-technique-body.css'),'utf8');
const skills=readFileSync(join(here,'../src/rebuild/skill-system.js'),'utf8');

test('bottom rail is the five-item heart technique body item time system',()=>{
  assert.match(gameplay,/data-heart/);assert.match(gameplay,/data-techniques/);assert.match(gameplay,/data-body/);assert.match(gameplay,/data-items/);assert.match(gameplay,/data-debug/);
  assert.doesNotMatch(gameplay,/data-map/);assert.doesNotMatch(gameplay,/data-dash/);
});

test('heart is a passive learned-skill five-column catalogue',()=>{
  assert.match(loadout,/model\.ui\.title\.textContent='心'/);assert.match(loadout,/習得したスキル/);assert.match(loadout,/learnedHeartSkills/);assert.doesNotMatch(loadout,/セット中|未セット/);
  assert.match(css,/\.loadout-grid\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/s);
  assert.doesNotMatch(skills,/activeHeart/);
});

test('technique page uses three intent slots and learned named combo techniques',()=>{
  assert.match(loadout,/model\.ui\.title\.textContent='技'/);assert.match(loadout,/意識/);assert.match(loadout,/setTechniqueIntentSlot/);assert.match(loadout,/learnedTechniques/);assert.match(css,/\.loadout-slot-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(gameplay,/data-one-motion/);assert.match(gameplay,/消耗大 \/ 隙大/);
});

test('body page uses stance distance zanshin slots filters and category badges',()=>{
  assert.match(loadout,/model\.ui\.title\.textContent='体'/);assert.match(loadout,/body-filter-tabs/);assert.match(loadout,/learnedBodySkills/);assert.match(loadout,/badge:row\.category/);assert.match(loadout,/構え/);assert.match(loadout,/間合い/);assert.match(loadout,/残心/);
  assert.match(css,/data-kind="stance"/);assert.match(css,/data-kind="style"/);assert.match(css,/data-kind="zanshin"/);
});

test('long press details and tactile materials remain mobile-safe without glass',()=>{
  assert.match(loadout,/setTimeout\(\(\)=>\{fired=true;run\(\);\},480\)/);assert.match(loadout,/loadout-detail-popover/);
  assert.match(css,/clip-path:polygon/);assert.match(css,/box-shadow:inset/);assert.match(css,/repeating-linear-gradient/);assert.match(css,/env\(safe-area-inset-bottom\)/);assert.match(css,/@media\(max-width:410px\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/backdrop-filter/);
});
