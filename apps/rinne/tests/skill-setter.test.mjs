import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const ui=readFileSync(join(here,'../src/gameplay-ui.js'),'utf8');
const css=readFileSync(join(here,'../src/skill-setter.css'),'utf8');

test('mobile skill setter provides an in-play technique route and immediate spark action',()=>{
  assert.match(ui,/data-techniques/);
  assert.match(ui,/data-spark-set/);
  assert.match(ui,/兵法帖/);
  assert.match(ui,/今セット/);
  assert.match(ui,/SKILL_BY_ID/);
  assert.match(ui,/observeKnownSkills/);
  assert.match(ui,/filter\(id=>!knownSnapshot\.has\(id\)&&SKILL_BY_ID\[id\]\)/);
});

test('setting a discovered technique is a two-tap technique then jo-ha-kyu flow',()=>{
  assert.match(ui,/selectedSkill=id/);
  assert.match(ui,/state\.skillWeights\[phase\]=\{\[selectedSkill\]:100\}/);
  assert.match(ui,/\['jo','序'\].*\['ha','破'\].*\['kyu','急'\]/s);
  assert.match(ui,/technique-phase-list/);
  assert.match(ui,/ここへセット/);
  assert.doesNotMatch(ui,/drag.*skillWeights|drop.*skillWeights/i,'drag and drop must not be required to equip a technique');
});

test('skill sheet supports thumb-sized controls and downward swipe dismissal without flat glass styling',()=>{
  assert.match(ui,/sheetDrag\.dy>=64/);
  assert.match(css,/\.technique-entry\{[^}]*min-height:67px/s);
  assert.match(css,/\.technique-phase\{[^}]*min-height:72px/s);
  assert.match(css,/clip-path:polygon/);
  assert.match(css,/box-shadow:inset/);
  assert.match(css,/repeating-linear-gradient/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/@media\(max-width:410px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/backdrop-filter/);
});
