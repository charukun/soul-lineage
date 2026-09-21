import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';

const stageSource=()=>readFileSync(new URL('../src/nocturne-stage.js',import.meta.url),'utf8');

test('battle2 defaults to the P7 canonical presentation while P2-P4 stay explicit comparison modes',()=>{
  const source=stageSource();
  assert.match(source,/legacyMode=\['p2','p3','p4'\]\.includes\(requested\)/);
  assert.match(source,/reviewMode=legacyMode\?requested:'p7'/);
  assert.match(source,/createJohakyuP7Controller/);
  assert.match(source,/stage\.dataset\.reviewMode=reviewMode/);
});

test('P7 review fixture visibly exercises jo/ha/kyu, 2v3, physiology and checkpoint resume without app imports',()=>{
  const scenario=createJohakyuP7ReviewScenario(),phases=new Set(),eventIds=new Set();
  let maxInjury=0,minStamina=100,maxResumes=0,maxEpoch=1,frames=0;
  for(let i=0;i<12*60;i++){
    const result=scenario.step(1/60),frame=result.frame,meta=result.meta;frames++;
    phases.add(meta.phase);maxResumes=Math.max(maxResumes,meta.resumes);maxEpoch=Math.max(maxEpoch,meta.epoch);minStamina=Math.min(minStamina,meta.stamina);
    assert.equal(frame.authority,'rinne-domain');assert.equal(frame.reviewFixture,'p7');assert.equal(frame.actors.length,5);assert.equal(frame.obstacles.length,2);
    assert.equal(frame.actors.filter(actor=>actor.side==='party').length,2);assert.equal(frame.actors.filter(actor=>actor.side==='enemy').length,3);
    for(const actor of frame.actors)for(const row of Object.values(actor.body))maxInjury=Math.max(maxInjury,row.severity);
    for(const event of result.events){assert.ok(!eventIds.has(event.id),event.id);eventIds.add(event.id);assert.ok(event.damage>0);assert.ok(event.bodyPart);}
  }
  assert.equal(frames,720);assert.deepEqual([...phases].sort(),['ha','jo','kyu']);assert.ok(eventIds.size>8);assert.ok(maxInjury>0);assert.ok(minStamina<90);assert.ok(maxResumes>=1);assert.ok(maxEpoch>=2);
});

test('P7 fixture is deterministic and exposes read-only inspection instead of save or clock side effects',()=>{
  const a=createJohakyuP7ReviewScenario(),b=createJohakyuP7ReviewScenario();
  for(let i=0;i<420;i++)assert.deepEqual(a.step(1/60),b.step(1/60));
  const inspected=a.inspect();assert.ok(Object.isFrozen(inspected));assert.ok(Object.isFrozen(inspected.frame));assert.throws(()=>{inspected.frame.actors[0].hp=0;},TypeError);
  const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/apps\/rinne|localStorage|sessionStorage|Math\.random|Date\.now|setInterval/);
  assert.match(source,/createJohakyuCheckpoint/);assert.match(source,/restoreJohakyuCheckpoint/);assert.match(source,/applyJohakyuImpactOnce/);
});
