import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceReviewFinisher,createReviewFinisher,normalizeReviewBattlePhase,reviewBattleCameraFrame,reviewBattleLoopDue,reviewBattlePhaseState,reviewBattleMultiHitFrame,reviewBattlePresentationFrame} from '../src/review-battle-state.js';
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
  const ending={done:true,hero:{x:0,z:0,yaw:0,dead:false},enemy:{x:20,z:20,hp:0,dead:true},enemies:[{x:20,z:20,hp:0,dead:true}]},previous={done:false,hero:{x:0,z:0,yaw:0,dead:false},enemy:{x:2,z:0,hp:1,dead:false},enemies:[{x:2,z:0,hp:1,dead:false}]};
  let finisher=createReviewFinisher(ending,previous);assert.ok(finisher);assert.deepEqual(finisher.target,{x:2,z:0});
  const opening=advanceReviewFinisher(finisher,0);assert.equal(opening.core.done,false);assert.equal(opening.core.enemies[0].downed,true);assert.equal(opening.core.hero.skill,'止め');assert.equal(opening.core.enemies[0].x,2);assert.equal(opening.core.enemies[0].z,0);
  finisher=opening.run;const impact=advanceReviewFinisher(finisher,.72);assert.equal(impact.impact,true);assert.equal(impact.core.enemies[0].dead,false);
  const finished=advanceReviewFinisher(impact.run,.8);assert.equal(finished.finished,true);assert.equal(finished.core.done,true);assert.equal(finished.core.enemies[0].dead,true);
});

const assertVectorClose=(actual,expected,epsilon=1e-12)=>{for(const key of ['x','y','z'])assert.ok(Math.abs(actual[key]-expected[key])<=epsilon,`${key}: ${actual[key]} != ${expected[key]}`);};

test('review camera uses the same shared Rinne and Demon combat framing contracts',()=>{
  const core={hero:{x:-2,z:1},enemy:{x:2,z:3}};
  const rinne=reviewBattleCameraFrame(core,{follow:true,system:'rinne',encounterMode:'duel'});
  const demon=reviewBattleCameraFrame(core,{follow:true,system:'demon',encounterMode:'duel',wide:true});
  assert.equal(rinne.follow,true);assert.equal(rinne.system,'rinne');assert.equal(rinne.count,1);
  assert.equal(demon.follow,true);assert.equal(demon.system,'demon');assert.equal(demon.count,1);
  assert.notDeepEqual(rinne.position,demon.position);
  const directRinne=combatCameraFrame({player:{x:-2,z:1},threats:[{id:'enemy-0',x:2,z:3,dead:false}],style:'rinne',wide:false});
  const directRinnePosition=combatCameraPosition(directRinne);
  assert.equal(rinne.lock,'hero');assert.equal(rinne.look.x,core.hero.x);assert.equal(rinne.look.z,core.hero.z);
  assertVectorClose({x:rinne.position.x-rinne.look.x,y:rinne.position.y-rinne.look.y,z:rinne.position.z-rinne.look.z},{x:directRinnePosition.x-directRinne.look.x,y:directRinnePosition.y-directRinne.look.y,z:directRinnePosition.z-directRinne.look.z});
  const directDemon=combatCameraFrame({player:{x:-2,z:1},threats:[{id:'enemy-0',x:2,z:3,dead:false}],style:'demon',wide:true});
  const directDemonPosition=combatCameraPosition(directDemon);
  assert.equal(demon.lock,'hero');assert.equal(demon.look.x,core.hero.x);assert.equal(demon.look.z,core.hero.z);
  assertVectorClose({x:demon.position.x-demon.look.x,y:demon.position.y-demon.look.y,z:demon.position.z-demon.look.z},{x:directDemonPosition.x-directDemon.look.x,y:directDemonPosition.y-directDemon.look.y,z:directDemonPosition.z-directDemon.look.z});
  const melee=reviewBattleCameraFrame({...core,enemies:[core.enemy,{x:2,z:1,dead:false},{x:2,z:5,dead:false}]},{follow:true,system:'rinne',encounterMode:'one-v-three'});
  assert.equal(melee.count,3);assert.ok(melee.separation>=rinne.separation);
  const finisherCamera=reviewBattleCameraFrame({hero:{...core.hero,skill:'止め'},enemy:core.enemy},{follow:true,system:'rinne'});
  assert.equal(finisherCamera.finisher,true);assert.equal(finisherCamera.lock,'hero');
  assert.ok(Math.hypot(finisherCamera.position.x-finisherCamera.look.x,finisherCamera.position.z-finisherCamera.look.z)<Math.hypot(rinne.position.x-rinne.look.x,rinne.position.z-rinne.look.z));
  const fixed=reviewBattleCameraFrame(core,{follow:false});
  assert.deepEqual(fixed.position,{x:0,y:5.2,z:10});
  assert.deepEqual(fixed.look,{x:0,y:.95,z:0});
  const actor={x:-1,z:0,attack:'slash',progress:.5,slot:'ha'},target={x:1,z:0};
  const presentation=reviewBattlePresentationFrame(actor,target,null,1/60);
  assert.equal(presentation.x,-1);assert.equal(presentation.z,0);assert.equal(presentation.lunge,0);assert.equal(presentation.recoil,0);assert.equal(presentation.authoritative,true);
  const settled=reviewBattlePresentationFrame({...actor,attack:null,progress:0},target,presentation,1/60);
  assert.equal(settled.x,-1);assert.equal(settled.z,0);
  const hit=reviewBattlePresentationFrame({...actor,attack:null,progress:0},target,settled,1/60,{hit:true});
  assert.equal(hit.x,-1);assert.equal(hit.z,0);assert.equal(hit.hit,true);
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
  const runtimeSource=readFileSync(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');
  assert.match(battleSource,/enemyModel='skeleton-minion'/);
  assert.match(stageSource,/loadReviewMonsterModel\('skeleton-minion'\)/);
  assert.match(stageSource,/loadReviewMonsterModel\('skeleton-warrior'\)/);
  assert.match(stageSource,/loadReviewMonsterModel\('skeleton-rogue'\)/);
  assert.match(stageSource,/battleGeometry='tidebreak-authoritative-contact'/);
  assert.doesNotMatch(stageSource,/ReviewMonsterSilhouette|installReviewEquipment\(side\.actor/);
  assert.match(monsterSource,/KayKit-Character-Pack-Skeletons-1\.0/);
  assert.match(monsterSource,/15b62b9bad122f72926c10fb14d622c73819fa54/);
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
  assert.match(battleSource,/reviewTechniqueSeen=new Map\(\)/);assert.match(battleSource,/seen\.add\(technique\.id\)/);
  assert.match(battleSource,/learnedSlots\[phase\]=technique/);
  assert.match(battleSource,/INSPIRATION_BULB_HOLD_MS=550/);assert.match(battleSource,/bulbTimer=setTimeout\(hideInspirationBulb,INSPIRATION_BULB_HOLD_MS\)/);assert.match(battleSource,/if\(cue==='spacing'\)\{battleSfx\.inspiration\('anticipation'\);return;\}/);
  assert.match(stageSource,/hyakunen-shared/);assert.match(stageSource,/kuumetsu-shared/);
  assert.match(battleHtml,/id="battle-history-open"/);assert.match(battleHtml,/class="battle-stage-switch"/);
  assert.match(battleHtml,/battle-phase-wave/);assert.match(battleHtml,/battle-action-drift/);
  assert.match(battleHtml,/Compact battle HUD pass/);assert.match(battleHtml,/#battle-technique-composition,/);assert.match(battleHtml,/position:fixed!important/);
  assert.match(battleHtml,/\.stage>\.technique-loadout\{left:8px!important;right:auto!important;top:8px!important;bottom:auto!important/);
  assert.match(battleHtml,/\.controls\.review-surface__panel\{min-height:0!important;height:auto!important/);
  assert.match(battleHtml,/grid-template-columns:minmax\(0,1fr\) auto!important/);
  assert.match(battleSource,/createTidebreakRuntime/);assert.doesNotMatch(battleSource,/RaidHost/);
  assert.match(battleSource,/opponent:group\?'group':'duel'/);
  assert.match(battleSource,/const angle=battleStage\?\.cameraAngle\?\.\(\)\|\|0,input=reviewSwipe\.vector\(angle\)/);assert.match(battleSource,/runtime\.input\(input\.screenX,input\.screenY,input\.amount,angle\)/);assert.match(battleSource,/createReviewFinisher\(next,previous\)/);
  assert.match(stageSource,/cameraOrbit=\(cameraOrbit\+step\*\.05\)/);assert.match(stageSource,/!frame\.finisher/);assert.match(stageSource,/cameraLock=frame\.lock\|\|'scene'/);
  assert.match(stageSource,/function inspirationCameraFrame\(sequence\)/);assert.match(stageSource,/backstep=Math\.max\(0,Math\.min\(1,Number\(sequence\?\.backstepProgress\)\|\|0\)\)/);assert.match(stageSource,/shoulder=2\.05\*orbit/);assert.match(stageSource,/lock:orbit>\.02\?'hero-over-shoulder':'hero-rear'/);assert.match(stageSource,/inspirationCameraFrame\(sequence\)/);
  assert.match(stageSource,/zoomBy\(delta=0\)/);
  assert.match(battleHtml,/id="camera-zoom-out"/);assert.match(battleHtml,/id="camera-zoom-in"/);
  assert.doesNotMatch(battleHtml,/class="hud battle-vitals"/);
  assert.match(battleHtml,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(battleHtml,/-webkit-line-clamp:2!important/);
  assert.match(battleHtml,/敵モデル<\/span><strong>スケルトン<\/strong>/);
  assert.match(battleSource,/hero:\{x:-2\.65,z:0\},enemy:\{x:2\.65,z:0\}/);
  assert.match(battleSource,/enemies:\[\{x:2\.65,z:0\},\{x:2\.45,z:-1\.75\},\{x:2\.45,z:1\.75\}\]/);
  assert.match(runtimeSource,/import \{ SwipeInput \} from '@soul\/input'/);assert.match(runtimeSource,/const swipe=new SwipeInput\(\)/);assert.match(runtimeSource,/swipe\.vector\(0\)/);
  assert.match(stageSource,/cameraZoom=\.82/);
  assert.match(stageSource,/cameraAngle\(\)\{return Math\.atan2\(camera\.position\.x-cameraLook\.x,camera\.position\.z-cameraLook\.z\);\}/);
  assert.match(battleHtml,/main\.battle-review\.review-surface > \.review-surface__workspace\{/);
  assert.match(battleHtml,/grid-template-rows:minmax\(0,1fr\) max-content!important/);
  assert.match(battleHtml,/min-height:34px!important;\s*max-height:36px!important/);
assert.match(stageSource,/weaponSegment/);assert.match(stageSource,/rightHand/);assert.match(stageSource,/binding='right-hand-bone'/);assert.match(stageSource,/userData\.weaponBinding=binding/);assert.match(stageSource,/presentImpact/);
  assert.match(battleSource,/battleSfx\.impact\(\{guard:Boolean\(impact\?\.guard\),power:Number\(impact\?\.power\)\|\|\.7\}\)/);assert.match(battleSource,/battleSfx\.swing\(/);
  assert.doesNotMatch(stageSource,/reviewBattleMultiHitFrame/);assert.doesNotMatch(stageSource,/function ring\(|\.marker\b/);assert.match(stageSource,/core\?\.enemies/);
  assert.match(stageSource,/onInspirationCue\('spark'/);
});
