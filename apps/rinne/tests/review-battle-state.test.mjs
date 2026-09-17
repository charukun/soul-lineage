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

test('follow camera centers the same combatants while fixed mode stays canonical',()=>{
  const core={hero:{x:-2,z:1},enemy:{x:2,z:3}};
  const follow=reviewBattleCameraFrame(core,{follow:true});
  assert.equal(follow.follow,true);
  assert.equal(follow.look.x,0);
  assert.equal(follow.look.z,2.3);
  assert.ok(follow.separation>5);
  assert.ok(follow.position.z>9.8);
  const fixed=reviewBattleCameraFrame(core,{follow:false});
  assert.deepEqual(fixed.position,{x:0,y:4.7,z:7.5});
  assert.deepEqual(fixed.look,{x:0,y:.95,z:0});
});
