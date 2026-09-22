import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';

function observe(scenario,frames=900){
  const trace=new Map(),events=[],snapshots=[];
  for(let i=0;i<frames;i++){
    const r=scenario.step(1/60);events.push(...r.events);snapshots.push(r);
    for(const row of scenario.inspect().trace)trace.set(JSON.stringify(row),row);
  }
  return{trace:[...trace.values()],events,snapshots};
}
test('real reversal from stale ha completes counter before the next normal jo',()=>{
  const scenario=createJohakyuP7ReviewScenario({heroStartPhase:'ha',heroStartTechniqueIndex:1,enemyLeadSeconds:.2});
  const {trace,snapshots}=observe(scenario,1000);
  const parry=trace.find(e=>e.type==='parry'&&e.strongParry&&e.targetId==='hero');assert.ok(parry);
  const normal=trace.find(e=>e.type==='normal-offense-start'&&e.actorId==='hero'&&e.time>parry.time);assert.ok(normal);assert.equal(normal.phase,'jo');
  const transition=snapshots.filter(s=>(s.frame.actors.find(a=>a.self)?.action?.reaction==='counter'||s.frame.actors.find(a=>a.self)?.action?.counterTransition));assert.ok(transition.length);
  for(const s of transition)assert.equal(s.meta.hudState,'maai');
  const first=snapshots.find(s=>s.meta.initiativeId==='hero'&&s.meta.exchangeMode==='pressure'&&s.meta.hudState!=='maai'&&s.frame.revision>transition[0].frame.revision);
  assert.ok(first);assert.equal(first.meta.hudState,'jo');
});
test('1v3 leaves secondary pairs able to execute actual contacts during a primary exchange',()=>{
  const {events,snapshots}=observe(createJohakyuP7ReviewScenario({mode:'oneVsThree'}),1200);
  const secondary=events.filter(e=>['enemy-b','enemy-c'].includes(e.sourceId));
  assert.ok(secondary.some(e=>e.sourceId==='enemy-b'));assert.ok(secondary.some(e=>e.sourceId==='enemy-c'));
  assert.ok(secondary.some(e=>e.type==='enemy-hit'&&e.damage>0),'secondary pressure must have actual world/domain contact');
  assert.ok(snapshots.some(s=>s.meta.exchangeMode==='pressure'&&s.frame.actors.some(a=>['enemy-b','enemy-c'].includes(a.id)&&a.action?.motion.offense)));
});
test('stamina and injured limbs constrain execution rather than granting initiative free attacks',()=>{
  const low=observe(createJohakyuP7ReviewScenario({heroStartPhase:'kyu',actorOverrides:{hero:{stamina:0}}}),60);
  assert.equal(low.events.some(e=>e.sourceId==='hero'&&e.damage>0&&e.phase==='kyu'),false);
  for(const s of low.snapshots)assert.ok(s.frame.actors.find(a=>a.self).stamina.value>=0);
  const injured=observe(createJohakyuP7ReviewScenario({actorOverrides:{hero:{body:{leftArm:.72,rightArm:.72,leftLeg:.72,rightLeg:.72}}}}),180);
  assert.equal(injured.events.some(e=>e.sourceId==='hero'&&e.damage>0),false);
  const positions=injured.snapshots.map(s=>s.frame.actors.find(a=>a.self).position);
  assert.ok(positions.every(p=>Math.hypot(p.x-positions[0].x,p.z-positions[0].z)<.01),'incapable legs cannot perform approach/orbit');
});
test('explicit checkpoint restore clears transient Exchange and old cursor without resetting physiology',()=>{
  const scenario=createJohakyuP7ReviewScenario({resumeAtSeconds:2});let before=null,resumed=null;
  for(let i=0;i<180;i++){
    const r=scenario.step(1/60);
    if(r.meta.resumes){resumed=r;break;}before=r;
  }
  assert.ok(resumed);assert.equal(resumed.meta.hudState,'maai');assert.equal(resumed.meta.phase,'jo');assert.equal(resumed.meta.exchangeMode,'read');
  assert.equal(resumed.frame.actors.some(a=>a.action),false);
  const hero=resumed.frame.actors.find(a=>a.self),prior=before.frame.actors.find(a=>a.self);
  assert.equal(hero.hp,prior.hp);assert.ok(Math.abs(hero.stamina.value-prior.stamina.value)<1);
  assert.equal(scenario.inspect().exchanges.length,0);
});
