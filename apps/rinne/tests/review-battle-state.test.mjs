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

test('follow camera keeps the hero as the visual anchor and pulls farther back',()=>{
  const core={hero:{x:-2,z:1},enemy:{x:2,z:3}};
  const follow=reviewBattleCameraFrame(core,{follow:true});
  const heroWorld={x:-2*1.35,z:1*1.15},enemyWorld={x:2*1.35,z:3*1.15};
  assert.equal(follow.follow,true);
  assert.ok(follow.look.x<0);
  assert.ok(Math.abs(follow.look.x-heroWorld.x)<Math.abs(follow.look.x-enemyWorld.x));
  assert.ok(Math.abs(follow.look.z-heroWorld.z)<Math.abs(follow.look.z-enemyWorld.z));
  assert.ok(follow.separation>5);
  assert.ok(follow.position.z-follow.look.z>=10);
  assert.ok(follow.position.y>=5.2);
  const fixed=reviewBattleCameraFrame(core,{follow:false});
  assert.deepEqual(fixed.position,{x:0,y:5.2,z:10});
  assert.deepEqual(fixed.look,{x:0,y:.95,z:0});
});
