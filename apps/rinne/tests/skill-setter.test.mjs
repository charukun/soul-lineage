import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const ui=readFileSync(join(here,'../src/gameplay-ui.js'),'utf8');
const setter=readFileSync(join(here,'../src/skill-setter.js'),'utf8');
const css=readFileSync(join(here,'../src/skill-setter.css'),'utf8');

test('mobile skill setter provides an in-play technique route and immediate spark action',()=>{
  assert.match(ui,/data-techniques/);
  assert.match(ui,/data-spark-set/);
  assert.match(ui,/createSkillSetter/);
  assert.match(setter,/兵法帖/);
  assert.match(setter,/SKILL_BY_ID/);
  assert.match(setter,/observeKnownSkills/);
  assert.match(setter,/filter\(id=>!model\.knownSnapshot\.has\(id\)&&SKILL_BY_ID\[id\]\)/);
});

test('setting a discovered technique is a two-tap technique then jo-ha-kyu flow',()=>{
  assert.match(setter,/model\.selectedSkill=id/);
  assert.match(setter,/state\.skillWeights\[phase\]=\{\[model\.selectedSkill\]:100\}/);
  assert.match(setter,/\['jo','序'\].*\['ha','破'\].*\['kyu','急'\]/s);
  assert.match(setter,/technique-phase-list/);
  assert.match(setter,/ここへセット/);
  assert.doesNotMatch(setter,/drag.*skillWeights|drop.*skillWeights/i,'drag and drop must not be required to equip a technique');
});

test('skill sheet supports thumb-sized controls and downward swipe dismissal without flat glass styling',()=>{
  assert.match(setter,/sheetDrag\.dy>=64/);
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

test('skill setter responsibility is extracted from gameplay UI composition',()=>{
  assert.doesNotMatch(ui,/function\s+(?:renderSkills|renderMind|setTechnique|observeKnownSkills)\b/);
  assert.match(setter,/export function createSkillSetter/);
  assert.ok(ui.split('\n').length<100,'gameplay-ui should remain a compact composition layer');
});
