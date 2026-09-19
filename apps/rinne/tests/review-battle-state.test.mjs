import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeReviewBattlePhase,reviewBattleCameraFrame,reviewBattleLoopDue,reviewBattlePhaseState,reviewBattleMultiHitFrame,reviewBattlePresentationFrame} from '../src/review-battle-state.js';
import {REVIEW_INSPIRATION_TIMELINE,pickReviewInspiration,reviewInspirationCandidates,reviewInspirationSequenceFrame} from '../src/review-battle-inspiration.js';
import {combatCameraFrame,combatCameraPosition} from '@soul/rendering/combat-camera-frame';

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

const assertVectorClose=(actual,expected,epsilon=1e-12)=>{for(const key of ['x','y','z'])assert.ok(Math.abs(actual[key]-expected[key])<=epsilon,`${key}: ${actual[key]} != ${expected[key]}`);};

test('review camera uses the same shared Rinne and Demon combat framing contracts',()=>{
  const core={hero:{x:-2,z:1},enemy:{x:2,z:3}};
  const rinne=reviewBattleCameraFrame(core,{follow:true,system:'rinne',encounterMode:'duel'});
  const demon=reviewBattleCameraFrame(core,{follow:true,system:'demon',encounterMode:'duel',wide:true});
  assert.equal(rinne.follow,true);assert.equal(rinne.system,'rinne');assert.equal(rinne.count,1);
  assert.equal(demon.follow,true);assert.equal(demon.system,'demon');assert.equal(demon.count,1);
  assert.notDeepEqual(rinne.position,demon.position);
  const directRinne=combatCameraFrame({player:{x:-2.7,z:1.15},threats:[{id:'enemy',x:2.7,z:3.45,dead:false}],style:'rinne',wide:false});
  assertVectorClose(rinne.position,combatCameraPosition(directRinne));assertVectorClose(rinne.look,directRinne.look);
  const directDemon=combatCameraFrame({player:{x:-2.7,z:1.15},threats:[{id:'enemy',x:2.7,z:3.45,dead:false}],style:'demon',wide:true});
  assertVectorClose(demon.position,combatCameraPosition(directDemon));assertVectorClose(demon.look,directDemon.look);
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
  const sweep=reviewBattleMultiHitFrame({attack:'slash',progress:.5,slot:'ha'},{encounterMode:'one-v-three'});
  assert.equal(sweep.active,true);assert.equal(sweep.count,3);assert.ok(sweep.recoil>=.3);
  const finisher=reviewBattleMultiHitFrame({attack:'heavy',progress:.5,slot:'kyu'},{encounterMode:'one-v-three'});
  assert.ok(finisher.recoil>sweep.recoil);
  assert.equal(reviewBattleMultiHitFrame({attack:'thrust',progress:.5,slot:'kyu'},{encounterMode:'one-v-three'}).active,false);
  assert.equal(reviewBattleMultiHitFrame({attack:'slash',progress:.5,slot:'ha'},{encounterMode:'duel'}).active,false);
  const stageSource=readFileSync(new URL('../src/review-battle-stage.js',import.meta.url),'utf8');
  const battleSource=readFileSync(new URL('../src/review-battle.js',import.meta.url),'utf8');
  const battleHtml=readFileSync(new URL('../review-battle.html',import.meta.url),'utf8');
  const monsterSource=readFileSync(new URL('../src/review-battle-monster.js',import.meta.url),'utf8');
  assert.match(battleSource,/enemyModel='skeleton-minion'/);
  assert.match(stageSource,/loadReviewMonsterModel\('skeleton-minion'\)/);
  assert.match(stageSource,/loadReviewMonsterModel\('skeleton-warrior'\)/);
  assert.match(stageSource,/loadReviewMonsterModel\('skeleton-rogue'\)/);
  assert.match(stageSource,/battleGeometry='runtime-monster-models'/);
  assert.doesNotMatch(stageSource,/ReviewMonsterSilhouette|installReviewEquipment\(side\.actor/);
  assert.match(monsterSource,/KayKit-Character-Pack-Skeletons-1\.0/);
  assert.match(monsterSource,/reviewMonsterSpecies=id/);
  const answers=[
    {id:'a',kind:'technique',weapons:['sword'],phases:['ha'],steps:[{kind:'slash'},{kind:'crosscut'}]},
    {id:'b',kind:'technique',weapons:['sword'],phases:['ha','kyu'],steps:[{kind:'heavy'}]},
    {id:'c',kind:'technique',weapons:['spear'],phases:['ha'],steps:[{kind:'thrust'}]}
  ];
  assert.deepEqual(reviewInspirationCandidates(answers,{weapon:'sword',phase:'ha',learnedIds:['a']}).map(x=>x.row.id),['b']);
  assert.equal(pickReviewInspiration(answers,{weapon:'sword',phase:'ha',learnedIds:['a']},()=>0).id,'b');
  assert.equal(pickReviewInspiration(answers,{weapon:'sword',phase:'ha',learnedIds:['a','b']},()=>0),null);
  assert.equal(reviewInspirationSequenceFrame(REVIEW_INSPIRATION_TIMELINE.spacing+.01).stage,'spacing');
  assert.equal(reviewInspirationSequenceFrame(REVIEW_INSPIRATION_TIMELINE.stagger+.01).stage,'stagger');
  assert.equal(reviewInspirationSequenceFrame(REVIEW_INSPIRATION_TIMELINE.reveal+.01).stage,'reveal');
  assert.equal(reviewInspirationSequenceFrame(REVIEW_INSPIRATION_TIMELINE.execute+.01).stage,'execute');
  assert.match(battleSource,/learnedTechniqueIds\.add\(technique\.id\)/);
  assert.match(battleSource,/learnedSlots\[phase\]=technique/);
  assert.match(stageSource,/phaseAnchor='feet'/);
  assert.match(stageSource,/hyakunen-shared/);assert.match(stageSource,/kuumetsu-shared/);
  assert.match(battleHtml,/id="battle-history-open"/);assert.match(battleHtml,/class="battle-stage-switch"/);assert.match(battleHtml,/id="battle-technique-loadout" class="technique-loadout"/);
  assert.match(battleHtml,/battle-phase-wave/);assert.match(battleHtml,/battle-action-drift/);
  assert.match(battleHtml,/Compact battle HUD pass/);
  assert.match(battleHtml,/\.stage>\.technique-loadout\{left:8px!important;right:auto!important;top:8px!important;bottom:auto!important/);
  assert.match(battleHtml,/\.controls\.review-surface__panel\{min-height:0!important;height:auto!important/);
  assert.match(battleHtml,/grid-template-columns:minmax\(0,1fr\) auto!important/);
  assert.match(battleSource,/x:1\.9,z:0/);assert.match(battleSource,/x:-1\.9,z:0/);
  assert.match(battleSource,/runtime\.input\?\.\(manualMove\.x,manualMove\.y,manualMove\.amount,0\)/);
  assert.match(stageSource,/cameraOrbit=\(cameraOrbit\+step\*\.05\)/);
  assert.match(stageSource,/rx=-dz\/len,rz=dx\/len/);
  assert.match(stageSource,/zoomBy\(delta=0\)/);
  assert.match(battleHtml,/id="camera-zoom-out"/);assert.match(battleHtml,/id="camera-zoom-in"/);
  assert.doesNotMatch(battleHtml,/class="hud battle-vitals"/);
  assert.match(battleHtml,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(battleHtml,/-webkit-line-clamp:2!important/);
  assert.match(battleHtml,/敵モデル<\/span><strong>スケルトン<\/strong>/);
  assert.match(stageSource,/onInspirationCue\('spark'/);
});
