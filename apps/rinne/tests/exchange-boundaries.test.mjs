import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLife,serializeLife,deserializeLife} from '../src/rebuild/domain.js';
import {createFront} from '../src/rebuild/combat-core.js';
import {meleeSequenceHudState} from '../src/combat-sequence-hud.js';
import {createJohakyuExchangeState,reduceJohakyuExchange as reduce} from '../../../packages/johakyu-combat/src/exchange-policy.js';
const read=()=>createJohakyuExchangeState({sourceId:'hero',targetId:'enemy'});

test('main HUD gates actual slot by initiative, keeps ordinary pressure lit between attacks and hides reactions',()=>{
 let exchange=reduce(read(),{type:'normal-start',sourceId:'enemy',targetId:'hero',phase:'enemy'});
 for(const slot of ['ha','kyu'])assert.equal(meleeSequenceHudState({actorId:'hero',combat:{exchange,tidebreakPose:{slot}},attack:'斬り'}).hudState,'maai');
 exchange=reduce(exchange,{type:'parry',sourceId:'enemy',targetId:'hero',strong:true});
 assert.equal(meleeSequenceHudState({actorId:'hero',combat:{exchange,tidebreakPose:{slot:'ha'}}}).hudState,'maai');
 exchange=reduce(exchange,{type:'normal-start',sourceId:'hero',targetId:'enemy',phase:'jo'});
 for(const slot of ['jo','ha','kyu']){
  exchange=reduce(exchange,{type:'stage',sourceId:'hero',targetId:'enemy',phase:slot});
  const hud=meleeSequenceHudState({actorId:'hero',combat:{exchange,tidebreakPose:{slot}},interrupted:true});
  assert.equal(hud.hudState,slot);assert.equal(hud.activePhase,slot);assert.equal(hud.comboActive,true,'per-attack gaps and legacy damage animations do not end current pressure');
  assert.equal(meleeSequenceHudState({actorId:'hero',combat:{exchange,tidebreakPose:{slot,transition:true}}}).hudState,'maai');
 }
 exchange=reduce(exchange,{type:'kyu-complete',sourceId:'hero',targetId:'enemy',phase:'kyu'});
 assert.equal(meleeSequenceHudState({actorId:'hero',combat:{exchange}}).hudState,'zanshin');
 assert.equal(meleeSequenceHudState({actorId:'enemy',combat:{exchange}}).hudState,'maai');
});

test('real save/load retains permanent body/stamina/techniques but removes every pending exchange and cursor',()=>{
 const life=createLife({seed:91});life.ageSeconds=1200;life.ageYears=20;life.phase='living';life.zone='frontier';life.stamina=52;life.hp=68;life.injuries.leftArm={severity:.4,at:1200};
 for(const injury of Object.values(life.injuries))injury.at=life.ageSeconds;
 life.frontState=createFront();life.combat={phase:'kyu',sharedPhase:'ha',targetId:life.frontState.enemies[0].id,exchange:{mode:'reversal',initiativeId:life.id},pendingCounter:{until:4},oneMotionQueued:{skill:'x'},tidebreakPose:{attack:'slash'},zanshinSeconds:.4};life.attacking=true;
 const permanent=structuredClone({hp:life.hp,stamina:life.stamina,injuries:life.injuries,loadout:life.combatLoadout,knownSkills:life.knownSkills,inspiration:life.inspiration});
 delete permanent.inspiration.execution;
 const restored=deserializeLife(serializeLife(life));assert.deepEqual(restored.combat,{});assert.equal(restored.attacking,false);assert.equal(meleeSequenceHudState({actorId:life.id,combat:restored.combat}).hudState,'maai');
 assert.deepEqual({hp:restored.hp,stamina:restored.stamina,injuries:restored.injuries,loadout:restored.combatLoadout,knownSkills:restored.knownSkills,inspiration:restored.inspiration},permanent);
 assert.equal(life.combat.phase,'kyu');assert.equal(life.combat.exchange.mode,'reversal','saving never mutates the live encounter');
});

test('main integration observes canonical execution instead of reconstructing contact or completion from counters',()=>{
 const core=readFileSync(new URL('../src/rebuild/combat-core.js',import.meta.url),'utf8');
 assert.match(core,/next\.exchanges/);assert.match(core,/session\.runtime\.observeExchange/);assert.match(core,/row\.type==='kyu-complete'/);
 assert.doesNotMatch(core,/rotateAfterKyu|reduceJohakyuExchange|classifyJohakyuParry|kyuUses/);
 assert.match(core,/johakyuStageCapability/);assert.match(core,/chargeAttackStamina/);
 const observer=readFileSync(new URL('../../../packages/tidebreak-combat/exchange-observer.js',import.meta.url),'utf8');
 assert.doesNotMatch(observer,/\.hp\s*=|\.stamina\s*=|registerHit|Math\.random|collision\s*\(|setTimeout/);
 const review=readFileSync(new URL('../../review/src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.match(review,/action\.progress<\.46/,'canonical review contact trigger is not replaced by authored display contactProgress');
});
