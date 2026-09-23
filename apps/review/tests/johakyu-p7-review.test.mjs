import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';
import {resolveTechnique} from '@soul/johakyu-battle';
import {presentBattleFrame,presentBattleEvents} from '@soul/johakyu-presentation/battle-presentation';
import {battle2TechniqueCatalog,battle2SelectionAllowed} from '../src/nocturne/battle2-technique-catalog.js';
import {normalizeBattle2Loadout} from '../src/nocturne/battle2-loadout.js';
function run(options={},seconds=60){const scenario=createJohakyuP7ReviewScenario({...options,settings:{inspirationRate:'off',...(options.settings||{})}}),events=[],frames=[];for(let i=0;i<seconds*60;i++){const result=scenario.step(1/60);events.push(...result.meta.activity);if(i%6===0)frames.push(result.frame);}return{scenario,events,frames};}
test('Lab uses the shared authority for duel and multiple enemies with a complete technique/stage loadout',()=>{
 for(const mode of ['duel','oneVsThree']){const s=createJohakyuP7ReviewScenario({mode});assert.equal(s.inspect().frame.authority,'johakyu-battle');assert.equal(s.inspect().frame.actors.length,mode==='duel'?2:4);assert.equal(s.composition.hero.kyu[0].stages.length,3);}
 assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),RangeError);
});
test('every supported menu selection resolves the complete shared technique for its equipped weapon',()=>{
  assert.deepEqual(Object.keys(normalizeBattle2Loadout().technique).map(phase=>normalizeBattle2Loadout().technique[phase]),['basic.sword','basic.sword','basic.sword']);
  assert.deepEqual(Object.values(normalizeBattle2Loadout({equipment:{weapon:'great'},technique:{jo:'combo:opening-return'}}).technique),['basic.great','basic.great','basic.great']);
  assert.equal(battle2TechniqueCatalog({weapon:'sword'}).length,1);assert.equal(battle2SelectionAllowed('combo:opening-return'),false);
 for(const weapon of ['sword','great'])for(const row of battle2TechniqueCatalog({weapon})){assert.ok(battle2SelectionAllowed(row.id,{weapon}));assert.deepEqual(row.stages,resolveTechnique(row.id,{weapon}).stages);assert.ok(row.stages.length>=1);}
 assert.equal(battle2TechniqueCatalog({weapon:'great'})[0].id,'basic.great');
});
test('real exchanges visit all phases, retain identity through contact/presentation and do not deadlock without geometry samples',()=>{
 const {events,frames}=run({actorOverrides:{hero:{hp:800,maxHp:800},'enemy-a':{hp:10000,maxHp:10000}}});const starts=events.filter(e=>e.type==='stage-start'&&e.sourceId==='hero'),phases=new Set(starts.map(e=>e.phase));for(const p of ['jo','ha','kyu'])assert.ok(phases.has(p),p);
 const impacts=events.filter(e=>e.impact),seen=new Set();assert.ok(impacts.some(e=>e.type==='player-hit'));
 for(const event of impacts){assert.ok(!seen.has(event.id));seen.add(event.id);assert.ok(event.contactDistance<=event.contactReach);assert.equal(event.stageIndex,event.impact.stageIndex);assert.equal(event.techniqueId,event.impact.techniqueId);const p=presentBattleEvents([event])[0].presentation;assert.equal(p.techniqueId,event.techniqueId);assert.equal(p.stageIndex,event.stageIndex);}
 for(const frame of frames){const shown=presentBattleFrame(frame);for(const actor of shown.actors)if(actor.action){assert.equal(actor.action.presentation.techniqueId,actor.action.techniqueId);assert.equal(actor.action.presentation.stageIndex,actor.action.stageIndex);}}
});
test('reading, approach, retreat footwork and impulse remain observable with the accepted body clearance',()=>{
 const {events,frames}=run({loadout:{technique:{jo:'action.feint',ha:'action.guard-step',kyu:'action.crash'}}});const intents=new Set();let min=10,max=0,impulse=false;
 for(const f of frames){const a=f.actors.find(a=>a.self),b=f.actors.find(b=>b.side==='enemy'&&!b.dead&&!b.downed);if(a.exchange)intents.add(a.exchange.intent);if(a.impulseVelocity&&Math.hypot(a.impulseVelocity.x,a.impulseVelocity.z)>.01)impulse=true;if(b&&!a.downed){const d=Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);min=Math.min(min,d);max=Math.max(max,d);}}
 assert.ok(intents.has('approach'));assert.ok(intents.has('bait')||intents.has('orbit'));assert.ok(events.some(e=>e.type==='stage-start'&&e.sourceId==='hero'&&e.footwork==='retreat'));assert.ok(min>=1.46-1e-6);assert.ok(max-min>.5);assert.ok(impulse);
});
test('strong parry reverses the real exchange and creates a counter with recoil at that contact',()=>{
 const {events}=run({loadout:{technique:{jo:'action.counter',ha:'action.counter',kyu:'action.precision'}}});const strong=events.find(e=>e.strongParry);assert.ok(strong);assert.equal(strong.initiativeId,strong.targetId);assert.ok(strong.sourceKick>strong.impulse);assert.ok(strong.counterOpportunity>0);assert.ok(events.some(e=>e.type==='reaction-start'&&e.kind==='counter'&&e.sourceId===strong.targetId&&e.time>strong.time));
});
test('the Review Lab clash fixture shows two simultaneous shared attacks stopping at one zero-damage weapon contact',()=>{
 const scenario=createJohakyuP7ReviewScenario({fixture:'clash',duelGap:1.7,heroStartPhase:'ha'}),events=[];
 for(let i=0;i<600&&!events.some(e=>e.type==='clash');i++)events.push(...scenario.step(1/60).meta.activity);
 const clash=events.find(e=>e.type==='clash');assert.ok(clash);assert.equal(clash.damage,0);assert.ok(clash.sourceKick>0);assert.ok(clash.impulse>0);
 assert.equal(clash.techniqueId,'basic.sword');assert.ok([0,1,2].includes(clash.stageIndex));assert.equal(clash.impact.damage,0);assert.ok(events.some(e=>e.type==='interrupted'&&e.reason==='weapon-clash'&&[clash.attackId,clash.otherAttackId].includes(e.attackId)));
 assert.equal(scenario.inspect().frame.authority,'johakyu-battle');
});
test('stage motion starts without a separate phase hold and completes before phase changes',()=>{
 const {events,frames}=run({loadout:{technique:{jo:'action.feint',ha:'action.guard-step',kyu:'action.crash'}}},35);assert.equal(events.some(e=>e.type==='phase-cue'),false);assert.equal(frames.some(f=>f.actors.some(a=>a.phaseCue&&a.phaseCue.phase!=='zanshin')),false);
 for(const e of events.filter(e=>e.type==='phase-change')){const prior=events.slice(0,events.indexOf(e)).filter(x=>x.type==='technique-complete'&&x.sourceId===e.actorId).at(-1);assert.ok(prior);assert.equal(prior.time,e.time);}
});
test('an interrupted hero clears the action and sequence lamps across later frames, including after an enemy respawns',()=>{
 const scenario=createJohakyuP7ReviewScenario({fixture:'clash',duelGap:1.7,heroStartPhase:'ha'});let resets=0;
 for(let i=0;i<60*80;i++){
  const result=scenario.step(1/60);if(!result.events.some(e=>e.type==='interrupted'&&e.sourceId==='hero'))continue;
  const hero=result.frame.actors.find(a=>a.self);assert.equal(hero.action,null);assert.equal(hero.cursor.phaseIndex,0);assert.equal(hero.cursor.stageIndex,0);
  assert.equal(result.meta.actionId,null);assert.equal(result.meta.stageIndex,0);assert.equal(result.meta.hudState,'maai');
  const next=scenario.step(1/60);if(!next.frame.actors.find(a=>a.self).action)assert.equal(next.meta.hudState,'maai');resets++;
 }
 assert.ok(resets>2);
});
test('down, finisher, corpse and respawn are encounter lifecycle around shared combat',()=>{
 const {events}=run();for(const type of ['actor-downed','finisher-start','finisher','finisher-complete','enemy-spawn'])assert.ok(events.some(e=>e.type===type),type);
 const finish=events.find(e=>e.type==='finisher');assert.equal(finish.techniqueId,'finisher.execution');assert.ok(finish.impact.damage>0);
});
test('review checkpoints restart execution identities and cannot replay previous impacts',()=>{
 const {events,scenario}=run({checkpointSeconds:3},12);assert.equal(scenario.inspect().meta.resumes,1);const ids=events.filter(e=>e.impact).map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
});
undefined
test('enemy 葬焉 waits for full knockdown and recovery does not interrupt it',()=>{
 const scenario=createJohakyuP7ReviewScenario({actorOverrides:{hero:{hp:0,downed:true,incapacitated:true},'enemy-a':{readyDelay:0,spawnSeconds:0}}});let startAt=null,completeAt=null,recoverAt=null;
 for(let i=0;i<720&&recoverAt===null;i++){const result=scenario.step(1/60);for(const row of result.meta.activity){if(row.type==='finisher-start'&&row.sourceId!=='hero'&&row.targetId==='hero')startAt=i/60;if(row.type==='finisher-complete'&&row.sourceId!=='hero'&&row.targetId==='hero')completeAt=i/60;if(row.type==='hero-recovered')recoverAt=i/60;}}
 assert.ok(startAt!==null&&startAt>=1.5);assert.ok(completeAt!==null);assert.ok(recoverAt!==null&&recoverAt>=completeAt);
});

test('battle2 rescues inspiration into the current phase, first-casts it immediately, and keeps it equipped',()=>{
 const scenario=createJohakyuP7ReviewScenario({settings:{inspirationRate:'high'},actorOverrides:{hero:{hp:900,maxHp:900}}});let learned=null,started=null;
 for(let i=0;i<60*90&&(!learned||!started);i++){
  const result=scenario.step(1/60);
  learned||=result.meta.activity.find(row=>row.type==='inspiration'&&row.actorId==='hero');
  if(learned)started||=result.meta.activity.find(row=>row.type==='inspiration-start'&&row.sourceId==='hero'&&row.techniqueId===learned.techniqueId);
 }
 assert.ok(learned);assert.equal(learned.equipped,true);assert.equal(learned.firstCast,true);assert.ok(['jo','ha','kyu'].includes(learned.phase));
 assert.ok(started);assert.equal(started.phase,learned.phase);assert.equal(scenario.loadout.technique[learned.phase],learned.techniqueId);assert.ok(scenario.learnedTechniqueIds.includes(learned.techniqueId));
});
