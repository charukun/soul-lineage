import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuP7ReviewScenario as create} from '../src/nocturne/johakyu-p7-review.js';
const phaseIndex={jo:0,ha:1,kyu:2};

test('one normal initiative advances jo-ha-kyu, never flashes an old phase between actions, then owns zanshin',()=>{
 const scenario=create(),serialPhases=new Map();let completed=false,ordinaryGuard=false,weak=false;
 for(let i=0;i<1000;i++){
  const {meta:m,events}=scenario.step(1/60);
  if(m.initiativeId==='hero'&&m.exchangeMode==='pressure'&&m.hudState!=='maai'){
   const previous=serialPhases.get(m.exchangeSerial)??-1;assert.ok(phaseIndex[m.hudState]>=previous,`stale phase ${m.hudState} after ${previous}`);serialPhases.set(m.exchangeSerial,phaseIndex[m.hudState]);
  }
  for(const e of events){if(e.type==='guard'){ordinaryGuard=true;assert.equal(e.exchangeContinuity,'retain');}if(e.type==='parry'&&!e.strongParry){weak=true;assert.equal(e.exchangeContinuity,'retain');}}
  if(m.hudState==='zanshin'){completed=true;assert.equal(m.completedBy,'hero');assert.equal(serialPhases.get(m.exchangeSerial),2);}
 }
 assert.ok(completed&&ordinaryGuard&&weak);assert.equal(scenario.inspect().meta.resumes,0,'normal play never injects a checkpoint halfway through pressure');
});

test('successful strong parry and the real counter stay left; next normal offense starts jo rather than old ha',()=>{
 const scenario=create({heroStartPhase:'ha',heroStartTechniqueIndex:1,enemyLeadSeconds:.2});let reversal=false,counter=false,jo=false;
 for(let i=0;i<400&&!jo;i++){
  const {meta:m,frame,events}=scenario.step(1/60),action=frame.actors.find(a=>a.self).action;
  if(events.some(e=>e.strongParry&&e.targetId==='hero')){reversal=true;assert.equal(m.hudState,'maai');assert.equal(m.phase,'ha','old action cleanup has not been reset by contact');}
  if(m.exchangeMode==='reversal'){assert.equal(m.hudState,'maai');if(action?.scope==='combat-reaction'||action?.scope==='combat-counter-transition')counter=true;}
  if(reversal&&m.exchangeMode==='pressure'&&m.initiativeId==='hero'){jo=true;assert.equal(m.hudState,'jo');assert.equal(action?.phase,'jo');assert.equal(action?.stageIndex,0);}
 }
 assert.ok(reversal&&counter&&jo);
});

test('actual stamina rejection ends pressure; opponent completion never lights hero zanshin despite stale ha',()=>{
 const scenario=create({actorOverrides:{hero:{stamina:0,staminaCap:100}}});let rejected=false,opponentComplete=false,staleHidden=false;
 for(let i=0;i<620;i++){
  const {meta:m}=scenario.step(1/60);rejected ||= scenario.inspect().trace.some(t=>t.type==='execution-blocked'&&t.actorId==='hero'&&t.reason==='stamina-policy');
  if(m.initiativeId==='enemy-a'){assert.equal(m.hudState,'maai');staleHidden ||= m.phase==='ha'||m.phase==='kyu';if(m.exchangeMode==='zanshin'){opponentComplete=true;assert.equal(m.completedBy,'enemy-a');}}
  if(i<120)assert.notEqual(m.hudState,'kyu');
 }
 assert.ok(rejected&&opponentComplete&&staleHidden);
});

test('injured arms cannot execute attack stages and injured legs cannot provide footwork',()=>{
 const arms=create({actorOverrides:{hero:{body:{leftArm:.9,rightArm:.9}}}});let blocked=false;
 for(let i=0;i<240;i++){
  const r=arms.step(1/60);assert.equal(r.events.some(e=>e.sourceId==='hero'&&e.damage>0),false);assert.notEqual(r.meta.hudState,'kyu');
  blocked ||= arms.inspect().trace.some(t=>t.type==='execution-blocked'&&t.reason==='arm-injury');
 }
 assert.ok(blocked);
 const legs=create({actorOverrides:{hero:{body:{leftLeg:.9,rightLeg:.9}}}});let origin=null;
 for(let i=0;i<120;i++){const hero=legs.step(1/60).frame.actors.find(a=>a.self);origin??=hero.position;assert.deepEqual(hero.position,origin);}
});

test('secondary enemies actually contact during the primary pair exchange',()=>{
 const scenario=create({mode:'oneVsThree'}),secondary=new Set();let distinctPairs=false;
 for(let i=0;i<1200;i++){
  const r=scenario.step(1/60);
  if(r.meta.exchangeMode==='pressure')for(const e of r.events)if(['enemy-b','enemy-c'].includes(e.sourceId)&&e.type==='enemy-hit')secondary.add(e.sourceId);
  distinctPairs ||= scenario.inspect().exchanges.length>=3;
 }
 assert.deepEqual([...secondary].sort(),['enemy-b','enemy-c']);assert.ok(distinctPairs);
});

test('explicit checkpoint destroys transient exchange and old phase while retaining resource state',()=>{
 const scenario=create({checkpointSeconds:7.5});let before=null,resumed=false;
 for(let i=0;i<480;i++){
  const r=scenario.step(1/60);if(r.meta.resumes&&!resumed){resumed=true;assert.equal(r.meta.exchangeMode,'read');assert.equal(r.meta.phase,'jo');assert.equal(r.meta.hudState,'maai');assert.equal(r.meta.initiativeId,null);assert.equal(r.frame.actors[0].action,null);assert.ok(r.meta.stamina<100);assert.ok(before.meta.phase==='ha');}
  before=r;
 }
 assert.ok(resumed);
});
