import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReviewBattlePhase,reviewBattleCameraFrame,reviewBattleLoopDue,reviewBattlePhaseState,reviewBattlePresentationFrame} from '../src/review-battle-state.js';

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

test('review camera uses the same shared Rinne and Demon combat framing contracts',()=>{
  const core={hero:{x:-2,z:1},enemy:{x:2,z:3}};
  const rinne=reviewBattleCameraFrame(core,{follow:true,system:'rinne',encounterMode:'duel'});
  const demon=reviewBattleCameraFrame(core,{follow:true,system:'demon',encounterMode:'duel'});
  assert.equal(rinne.follow,true);assert.equal(rinne.system,'rinne');assert.equal(rinne.count,1);
  assert.equal(demon.follow,true);assert.equal(demon.system,'demon');assert.equal(demon.count,1);
  assert.notDeepEqual(rinne.position,demon.position);
  const melee=reviewBattleCameraFrame(core,{follow:true,system:'rinne',encounterMode:'melee'});
  assert.equal(melee.count,3);assert.ok(melee.separation>=rinne.separation);
  const fixed=reviewBattleCameraFrame(core,{follow:false});
  assert.deepEqual(fixed.position,{x:0,y:5.2,z:10});
  assert.deepEqual(fixed.look,{x:0,y:.95,z:0});
  const actor={x:-1,z:0,attack:'slash',progress:.5,slot:'ha'},target={x:1,z:0};
  const presentation=reviewBattlePresentationFrame(actor,target,null,1/60);
  assert.ok(presentation.x>-1.35,'mid-strike should lunge toward the target');
  assert.ok(presentation.lunge>.2);assert.ok(presentation.stride>0);
  const settled=reviewBattlePresentationFrame({...actor,attack:null,progress:0},target,presentation,1/60);
  assert.ok(settled.x<presentation.x,'recovery should settle back toward the authoritative combat position');
  const hit=reviewBattlePresentationFrame({...actor,attack:null,progress:0},target,settled,1/60,{hit:true});
  assert.ok(hit.x<settled.x,'incoming hit should add a short readable recoil away from the target');
});
