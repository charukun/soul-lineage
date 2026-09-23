import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';
import {normalizeBattle2Loadout} from '../src/nocturne/battle2-loadout.js';
import {battle2TechniqueCatalog,battle2InspirationCandidates,pickBattle2Inspiration} from '../src/nocturne/battle2-technique-catalog.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('the HUD identifies the equipped technique while combat retains its stage identities',()=>{
 const stage=read('src/nocturne-stage.js');assert.match(stage,/battle2SelectionLabel\(meta.techniqueSelection\)/);
 const scenario=createJohakyuP7ReviewScenario({loadout:{technique:{jo:'combo:combo-1'}},actorOverrides:{'enemy-a':{canAttack:false}}});
 assert.equal(scenario.composition.hero.jo.length,1);assert.equal(scenario.composition.hero.jo[0].id,'basic.sword');assert.equal(scenario.composition.hero.jo[0].stages.length,3);
 let meta;for(let i=0;i<900;i++){const next=scenario.step(1/60).meta;if(next.actionId&&next.phase==='jo'&&next.stageIndex===0){meta=next;break;}}
 assert.ok(meta);assert.equal(meta.techniqueSelection,'basic.sword');assert.notEqual(meta.techniqueName,'壱ノ連');
});
test('weapon change updates the basic technique ID, name, stages and authored binding together',()=>{
 const value=normalizeBattle2Loadout({equipment:{weapon:'great'},technique:{jo:'basic.sword'}});assert.equal(value.technique.jo,'basic.great');const basic=battle2TechniqueCatalog({weapon:'great'})[0];assert.equal(basic.name,'大剣の型');assert.deepEqual(basic.stages.map(s=>s.kind),['slash','sweep','heavy']);
});
test('accepted menus and portrait keep the six-column/shared UI surface',()=>{
 const ui=read('src/nocturne/battle2-loadout.js'),css=read('src/battle2.css');assert.match(ui,/戦闘で意識する心得/);assert.match(ui,/構え・葬焉・残心/);assert.match(css,/\.battle2-loadout-shell \.rinne-primary-four\{z-index:180!important\}/);assert.match(css,/review-switcher__grid\{grid-template-columns:repeat\(6/);assert.match(read('../../packages/shared-ui/src/rinne-player-hud.js'),/ctx\.drawImage/);
});
test('不殺 never executes a finisher, and reviewing discoveries never touches a life save',()=>{
 const scenario=createJohakyuP7ReviewScenario({loadout:{heart:{active:['skill.nonlethal','skill.patience','skill.edge']},technique:{jo:'action.counter',ha:'action.crash',kyu:'action.finish'}},actorOverrides:{hero:{hp:300,maxHp:300,damageScale:2}},settings:{inspirationRate:'high'}}),events=[];
 for(let i=0;i<5400;i++)events.push(...scenario.step(1/60).meta.activity);
 assert.ok(events.some(e=>e.type==='actor-downed'&&e.targetId!=='hero'));assert.ok(events.some(e=>e.type==='enemy-recovered'));assert.equal(events.some(e=>e.type==='finisher'),false);
 assert.ok(events.some(e=>e.type==='inspiration'&&e.scope==='review-trial'&&e.id&&e.targetId&&e.firstInspirationPresentation?.cameraSeconds>0));const source=read('src/nocturne/johakyu-p7-review.js');assert.doesNotMatch(source,/serializeLife|platform\.storage|commitAnswer/);
});

test('the selected 葬焉 motion is named at the right waveform only while it runs',()=>{
 const scenario=createJohakyuP7ReviewScenario({loadout:{body:{finisher:'danzetsu'}},actorOverrides:{'enemy-a':{hp:0,downed:true,incapacitated:true,spawnSeconds:0}}});
 let active=false,cleared=false;
 for(let i=0;i<300;i++){
  const {meta}=scenario.step(1/60);
  if(meta.actionKind==='finisher'){active=true;assert.equal(meta.finisherName,'断絶');}
  else if(active){assert.equal(meta.finisherName,null);cleared=true;break;}
 }
 assert.ok(active&&cleared);
 assert.match(read('src/nocturne-stage.js'),/johakyuSequenceMarkup\(\{battle2:true\}\)/);
 assert.match(read('../../packages/shared-ui/src/johakyu-hud.js'),/id=\\?"battle-sequence-finisher\\?"[^>]*hidden/);
 assert.match(read('src/nocturne-stage.js'),/finisherNode.hidden=!finisherName/);
 assert.match(read('src/nocturne/johakyu-p7-readout.css'),/\.battle-sequence-finisher/);
});

test('enemy respawn waits until 葬焉 finishes and the visible 残心 pose completes',()=>{
 const scenario=createJohakyuP7ReviewScenario({actorOverrides:{'enemy-a':{hp:0,downed:true,incapacitated:true,spawnSeconds:0}}});
 let completedAt=null,spawnedAt=null,poseSeen=false;
 for(let i=0;i<600&&spawnedAt===null;i++){
  const {meta}=scenario.step(1/60);
  if(meta.phaseCuePhase==='zanshin')poseSeen=true;
  for(const row of meta.activity){if(row.type==='finisher-complete'&&row.sourceId==='hero')completedAt=i/60;if(row.type==='enemy-spawn')spawnedAt=i/60;}
 }
 assert.ok(poseSeen);assert.ok(completedAt!==null&&spawnedAt!==null);
 assert.ok(spawnedAt-completedAt>=1.2,'the defeated enemy must not respawn during the finisher or zanshin');
});

test('閃きの初回発動イベントが描画へ一度渡り、習得と序破急スロットを維持する',()=>{
 const scenario=createJohakyuP7ReviewScenario({settings:{inspirationRate:'high'},actorOverrides:{hero:{hp:300,maxHp:300,damageScale:2},'enemy-a':{hp:2000,maxHp:2000,canAttack:false}}});
 let inspired=null;
 for(let i=0;i<1500&&!inspired;i++){
  const frame=scenario.step(1/60);
  inspired=frame.events.find(row=>row.type==='inspiration');
  if(inspired){
   assert.equal(frame.events.filter(row=>row.id===inspired.id).length,1);
   assert.equal(inspired.sourceId,'hero');
   assert.ok(inspired.targetId&&inspired.firstInspirationPresentation?.hudSeconds>1);
   assert.equal(inspired.equipped,true);assert.equal(inspired.firstCast,true);
   assert.equal(frame.meta.activity.find(row=>row.id===inspired.id),inspired);
  }
 }
 assert.ok(inspired,'a high-rate trial reaches its first cast');
});

test('閃きは初回演出と発動中だけ重ならず、終了後は再抽選できる',()=>{
 const seen=battle2InspirationCandidates({weapon:'sword',phase:'ha'}).map(item=>item.row.id);
 assert.ok(seen.length>0);assert.equal(pickBattle2Inspiration({weapon:'sword',phase:'ha',seenIds:seen}),null);
 const scenario=createJohakyuP7ReviewScenario({settings:{inspirationRate:'high'},actorOverrides:{hero:{hp:300,maxHp:300,damageScale:2},'enemy-a':{hp:9000,maxHp:9000,canAttack:false}}});
 const inspirations=[],completions=new Map();
 for(let i=0;i<3600;i++){
  for(const row of scenario.step(1/60).events){
   if(row.type==='inspiration')inspirations.push(row);
   if(row.type==='technique-complete'&&row.sourceId==='hero'&&!completions.has(row.techniqueId))completions.set(row.techniqueId,row.time);
  }
 }
 assert.ok(inspirations.length>=2,'new discoveries resume after the first presentation');
 assert.equal(new Set(inspirations.map(row=>row.techniqueId)).size,inspirations.length);
 for(let i=1;i<inspirations.length;i++){
  const previous=inspirations[i-1],next=inspirations[i];
  assert.ok(next.time-previous.time>=previous.firstInspirationPresentation.hudSeconds-1/60);
  assert.ok(next.time>=completions.get(previous.techniqueId)-1/60,'the first cast finishes before another discovery');
 }
 assert.ok(inspirations[1].time-inspirations[0].time<18,'there is no fixed post-reveal lockout');
});
