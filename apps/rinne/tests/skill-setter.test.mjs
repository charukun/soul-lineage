import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const ui=readFileSync(join(here,'../src/gameplay-ui.js'),'utf8');
const setter=readFileSync(join(here,'../src/skill-setter.js'),'utf8');
const loadout=readFileSync(join(here,'../src/heart-technique-body-ui.js'),'utf8');
const css=readFileSync(join(here,'../src/heart-technique-body.css'),'utf8');

test('discovery tracker routes learned support to heart and actions to named technique',()=>{
  assert.match(ui,/data-heart/);assert.match(ui,/data-techniques/);assert.match(ui,/data-spark-set/);assert.match(ui,/createSkillSetter/);
  assert.match(setter,/unseenHeart/);assert.match(setter,/unseenTechnique/);assert.match(setter,/skillType\(id\)==='support'/);assert.match(setter,/techniqueForSourceSkill/);assert.match(setter,/openHeart/);assert.match(setter,/openTechnique/);assert.match(setter,/observeKnownSkills/);
});

test('technique setting responsibility lives in the heart technique body module',()=>{
  assert.match(loadout,/setTechniqueIntentSlot/);assert.match(loadout,/learnedTechniques/);assert.match(loadout,/technique-intent-slots/);assert.match(loadout,/意識/);
  assert.doesNotMatch(setter,/state\.skillWeights/,'discovery tracker must not own combat loadout mutation');
});

test('heart technique body sheets remain thumb-safe and tactile',()=>{
  assert.match(ui,/sheetDrag\.dy>=64/);assert.match(css,/\.loadout-slot-card\{[^}]*min-height:82px/s);assert.match(css,/\.one-motion-control\{[^}]*min-height:52px/s);assert.match(css,/clip-path:polygon/);assert.match(css,/box-shadow:inset/);assert.match(css,/repeating-linear-gradient/);assert.match(css,/env\(safe-area-inset-bottom\)/);assert.match(css,/@media\(max-width:410px\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/backdrop-filter/);
});

test('loadout and discovery responsibilities stay extracted from gameplay UI composition',()=>{
  assert.doesNotMatch(ui,/function\s+(?:renderHeart|renderTechnique|renderBody|observeKnownSkills)\b/);assert.match(setter,/export function createSkillSetter/);assert.match(loadout,/export function createHeartTechniqueBodyUI/);assert.ok(ui.split('\n').length<120,'gameplay-ui should remain a compact composition layer');
});
