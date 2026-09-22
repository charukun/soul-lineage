import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {huntStakesState} from '../src/web/hunt-stakes-state.js';

const plan = Object.freeze({quota:2, bonus:6, marked:false, prey:'旅人'});
const state = overrides => ({plan, eaten:0, targetEaten:false, carried:0, ready:false, risk:{level:0,label:'静穏'}, ...overrides});

test('fresh hunt exposes the quota without zero-stake or quiet-pressure noise', () => {
  const view = huntStakesState(state());
  assert.equal(view.goal, '人影 0/2');
  assert.equal(view.haulHidden, true);
  assert.equal(view.pressureHidden, true);
  assert.equal(view.progress, 0);
  assert.equal(view.extraction, 0);
});

test('first native devour exposes unsecured stake and actual pressure together', () => {
  const input = state({eaten:1,carried:2,risk:{level:1,label:'気配'}});
  const before = structuredClone(input);
  const view = huntStakesState(input);
  assert.equal(view.goal, '人影 1/2');
  assert.equal(view.haul, '未確保 2');
  assert.equal(view.pressure, '警戒 気配');
  assert.equal(view.haulHidden, false);
  assert.equal(view.pressureHidden, false);
  assert.equal(view.pressureLevel, '1');
  assert.equal(view.progress, .5);
  assert.equal(view.extraction, 2);
  assert.deepEqual(input, before, 'display projection must not mutate hunt or save state');
});

test('earned bonus is a return prospect, not added to unsecured carried stake', () => {
  const view = huntStakesState(state({eaten:2,carried:4,ready:true,risk:{level:3,label:'包囲'}}));
  assert.equal(view.haul, '未確保 4 · 帰還 10');
  assert.equal(view.extraction, 10);
  assert.equal(view.pressureLevel, '3');
  assert.equal(view.progress, 1);
});

test('marked prey and authoritative readiness are not inferred from quota alone', () => {
  const marked = {...plan,marked:true,prey:'鐘番'};
  const pending = huntStakesState(state({plan:marked,eaten:3,carried:6}));
  assert.equal(pending.goal, '鐘番未 2/2');
  assert.equal(pending.extraction, 6);
  assert.equal(pending.progress, 1);
  const ready = huntStakesState(state({plan:marked,eaten:3,carried:6,targetEaten:true,ready:true}));
  assert.equal(ready.goal, '鐘番済 2/2');
  assert.equal(ready.extraction, 12);
});

test('native UI binds the projection and imports its scoped visual layer after minimal HUD', () => {
  const source = readFileSync(new URL('../src/web/hunt-flow-ui.js',import.meta.url),'utf8');
  assert.match(source,/huntStakesState\(\{plan, risk, ready, eaten:game\.eaten, carried:game\.carried, targetEaten:game\.targetEaten\}\)/);
  for (const key of ['goal','haul','haulHidden','pressure','pressureHidden','pressureLevel','progress']) assert.ok(source.includes(`stakes.${key}`));
  assert.ok(source.indexOf("import './hunt-stakes-readability.css'") > source.indexOf("import './hunt-minimal-hud.css'"));
});

test('scoped cascade removes the observed causes without changing other game sheets', () => {
  const css = readFileSync(new URL('../src/web/hunt-stakes-readability.css',import.meta.url),'utf8');
  assert.match(css,/body\.hunt-loop #hud \.hunt-bag>span\{\s*color:var\(--ink-hud-ink\)/);
  assert.match(css,/clip-path:none/);
  assert.match(css,/\.hunt-pressure\{grid-column:2;grid-row:1/);
  assert.match(css,/\.hunt-haul\{\s*grid-column:1\/-1;grid-row:2/);
  assert.match(css,/\[data-hunt-state="combat"\] #objective\{opacity:1\}/);
  assert.doesNotMatch(css,/#sheet|#game|\.nameplate/);
});
