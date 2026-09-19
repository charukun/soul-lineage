import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReviewBattlePhase,reviewBattleCameraFrame,reviewBattleLoopDue,reviewBattlePhaseState} from '../src/review-battle-state.js';

test('phase state follows the live Tidebreak slot and clears between attacks',()=>{
  const active=reviewBattlePhaseState({hero:{slot:'ha',skill:'崩し'},enemy:{slot:'jo'}});
  assert.deepEqual(active,{phase:'ha',heroPhase:'ha',enemyPhase:'jo',source:'left',skill:'崩し'});
  const between=reviewBattlePhaseState({hero:{slot:null},enemy:{slot:null}});
  assert.equal(between.phase,'');
  assert.equal(between.source,'');
  assert.equal(normalizeReviewBattlePhase('fake'),'');
});

test('enemy phase is visible when the left actor is not running a phase',()=>{
  const state=reviewBattlePhaseState({hero:{slot:null},enemy:{slot:'kyu',skill:'決め'}});
  assert.equal(state.phase,'kyu');
  assert.equal(state.source,'right');
  assert.equal(state.enemyPhase,'kyu');
});

test('loop waits for the configured result hold before restarting',()=>{
  assert.equal(reviewBattleLoopDue({loopEnabled:true,playing:true,finished:true,finishedAt:1000,now:1899}),false);
  assert.equal(reviewBattleLoopDue({loopEnabled:true,playing:true,finished:true,finishedAt:1000,now:1900}),true);
  assert.equal(reviewBattleLoopDue({loopEnabled:false,playing:true,finished:true,finishedAt:1000,now:2500}),false);
});

test('review combat camera composes the same Rinne and Demon framing contracts',()=>{
  const core={hero:{x:-2,z:1},enemy:{x:2,z:3}};
  const rinneFrame=()=>({look:{x:-1,y:1.08,z:2},offset:{x:8,y:8,z:12},count:1,spread:2});
  const demonFrame=()=>({camera:{x:7,y:10,z:15},look:{x:0,y:.75,z:2},count:1,spread:3});
  const follow=reviewBattleCameraFrame(core,{follow:true,rinneFrame,demonFrame});
  const heroWorld={x:-2*1.35,z:1*1.15},enemyWorld={x:2*1.35,z:3*1.15};
  assert.equal(follow.follow,true);
  assert.equal(follow.shared,true);assert.equal(follow.look.x,-.5);assert.equal(follow.position.x,7);assert.equal(follow.position.y,9.54);assert.equal(follow.separation,3);
  const melee=reviewBattleCameraFrame(core,{follow:true,encounterMode:'melee',rinneFrame:({enemies})=>({look:{x:0,y:1,z:0},offset:{x:8,y:8,z:12},count:enemies.length,spread:4}),demonFrame:game=>({camera:{x:8,y:10,z:14},look:{x:0,y:1,z:0},count:game.combatants.length+1,spread:4})});assert.equal(melee.count,3);
  const fixed=reviewBattleCameraFrame(core,{follow:false});
  assert.deepEqual(fixed.position,{x:0,y:5.2,z:10});
  assert.deepEqual(fixed.look,{x:0,y:.95,z:0});
});
