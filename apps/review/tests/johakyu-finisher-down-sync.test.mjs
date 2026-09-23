import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';

test('enemy 葬焉 starts only after the hero reaches canonical settled down pose',()=>{
 const scenario=createJohakyuP7ReviewScenario({actorOverrides:{hero:{hp:0,downed:true,incapacitated:true},'enemy-a':{readyDelay:0,spawnSeconds:0}}});
 let start=null,startPose=null,complete=null,recoverAt=null;
 for(let i=0;i<720&&recoverAt===null;i++){
  const result=scenario.step(1/60);
  for(const event of result.meta.activity){
   if(event.type==='finisher-start'&&event.sourceId!=='hero'&&event.targetId==='hero'){start=event;startPose=result.frame.actors.find(actor=>actor.id==='hero')?.downedState;}
   if(event.type==='finisher-complete'&&event.sourceId!=='hero'&&event.targetId==='hero')complete=event;
   if(event.type==='hero-recovered')recoverAt=result.frame.time;
  }
 }
 assert.ok(start);assert.ok(start.time>=1.85);assert.equal(startPose?.phase,'settled');assert.equal(startPose?.progress,1);
 assert.ok(complete);assert.ok(recoverAt!==null);assert.ok(recoverAt>=complete.time);
});
