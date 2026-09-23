import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';
import {normalizeBattle2Loadout} from '../src/nocturne/battle2-loadout.js';
import {battle2TechniqueCatalog} from '../src/nocturne/battle2-technique-catalog.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('the HUD names the actual technique while the common model preserves chain and stage identities',()=>{
 const stage=read('src/nocturne-stage.js');assert.match(stage,/meta.techniqueName/);assert.match(stage,/meta\?\.stageIndex/);assert.match(stage,/meta\.techniqueId/);
 const scenario=createJohakyuP7ReviewScenario({loadout:{technique:{jo:'combo:combo-1'}}});assert.equal(scenario.composition.hero.jo.length,3);assert.equal(scenario.composition.hero.jo[0].stages.length,3);
});
test('weapon change updates the basic technique ID, name, stages and authored binding together',()=>{
 const value=normalizeBattle2Loadout({equipment:{weapon:'great'},technique:{jo:'basic.sword'}});assert.equal(value.technique.jo,'basic.great');const basic=battle2TechniqueCatalog({weapon:'great'})[0];assert.equal(basic.name,'大剣の型');assert.deepEqual(basic.stages.map(s=>s.kind),['slash','sweep','heavy']);
});
test('accepted menus and portrait keep the five-column/shared UI surface',()=>{
 const ui=read('src/nocturne/battle2-loadout.js'),css=read('src/battle2.css');assert.match(ui,/戦闘で意識する心得/);assert.match(ui,/構え・葬焉・残心/);assert.match(css,/\.battle2-loadout-shell \.rinne-primary-four\{z-index:180!important\}/);assert.match(css,/review-switcher__grid\{grid-template-columns:repeat\(5/);assert.match(read('../../packages/shared-ui/src/rinne-player-hud.js'),/ctx\.drawImage/);
});
test('不殺 never executes a finisher, and reviewing discoveries never touches a life save',()=>{
 const scenario=createJohakyuP7ReviewScenario({loadout:{heart:{active:['skill.nonlethal','skill.patience','skill.edge']},technique:{jo:'action.counter',ha:'action.crash',kyu:'action.finish'}},actorOverrides:{hero:{hp:300,maxHp:300,damageScale:2}},settings:{inspirationRate:'high'}}),events=[];
 for(let i=0;i<5400;i++)events.push(...scenario.step(1/60).meta.activity);
 assert.ok(events.some(e=>e.type==='actor-downed'&&e.targetId!=='hero'));assert.ok(events.some(e=>e.type==='enemy-recovered'));assert.equal(events.some(e=>e.type==='finisher'),false);
 assert.ok(events.some(e=>e.type==='inspiration'&&e.scope==='review-trial'));const source=read('src/nocturne/johakyu-p7-review.js');assert.doesNotMatch(source,/serializeLife|platform\.storage|commitAnswer/);
});
