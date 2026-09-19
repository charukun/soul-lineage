import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {createFront,tickFront,tidebreakLoadoutFor,tidebreakMindsetFor,tidebreakWeaponFor} from '../src/rebuild/combat.js';

function combatState(seed=41){
  const state=createLife({seed});
  state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.resting=false;
  state.equipment.weapon='sword';state.knownSkills.push('basic.sword','skill.read','skill.patience','action.counter','action.finish');
  state.combatLoadout={heart:{active:['skill.read','skill.patience']},technique:{activeComboId:'combo-1',combos:[{id:'combo-1',name:'試験連技',slots:{jo:'action.counter',ha:'basic.sword',kyu:'action.finish'},favored:{}}],oneMotion:null},body:{stance:'seigan',style:'counter',zanshin:'still'}};
  return state;
}

test('Rinne equipment maps onto Tidebreak combat weapons without importing Tidebreak UI',()=>{
  assert.equal(tidebreakWeaponFor('sword'),'sword');
  assert.equal(tidebreakWeaponFor('dagger'),'sword');
  assert.equal(tidebreakWeaponFor('staff'),'spear');
  assert.equal(tidebreakWeaponFor('fist'),'fist');
});

test('Rinne heart/body choices become Tidebreak mindset and jo-ha-kyu recipes',()=>{
  const state=combatState();
  assert.equal(tidebreakMindsetFor(state),'patient');
  const loadout=tidebreakLoadoutFor(state);
  assert.deepEqual(Object.keys(loadout),['jo','ha','kyu','uke']);
  assert.equal(loadout.jo.name,'返し');
  assert.equal(loadout.kyu.name,'詰め');
  assert.ok(loadout.jo.steps.length>=1&&loadout.jo.steps.length<=3);
  assert.equal(loadout.uke.type,'reaction');
});

test('frontier combat is resolved by the headless Tidebreak runtime while keeping Rinne state',()=>{
  const state=combatState(73),front=createFront(0,73),enemy=front.enemies[0];
  front.enemies=[enemy];enemy.x=0;enemy.z=1.35;enemy.hp=enemy.maxHp=120;enemy.cooldown=0;
  let observed=[];
  for(let i=0;i<420&&!state.ended&&!state.down&&!enemy.dead;i++)observed.push(...tickFront(state,front,1/60));
  assert.equal(state.combat?.engine==='tidebreak'||enemy.dead||state.down||state.ended,true);
  const combatEvent=observed.find(event=>['player-hit','enemy-hit','evaded','enemy-down','downed','life-end'].includes(event.type));
  assert.ok(combatEvent,'Tidebreak duel should produce an observable combat result');
  assert.equal(combatEvent.engine,'tidebreak');
  assert.ok(Number.isFinite(state.position.x)&&Number.isFinite(state.position.z));
  assert.ok(Number.isFinite(enemy.x)&&Number.isFinite(enemy.z));

  const finisherState=combatState(91),finisherFront=createFront(0,91),downed=finisherFront.enemies[0];
  finisherFront.enemies=[downed];downed.x=0;downed.z=1.2;downed.hp=0;downed.downed=true;downed.downedElapsed=0;finisherState.hp=finisherState.maxHp=500;finisherState.defeats=1;
  const finisherEvents=[];for(let i=0;i<90&&!downed.dead;i++)finisherEvents.push(...tickFront(finisherState,finisherFront,1/60));
  assert.ok(finisherEvents.some(event=>event.type==='finisher-start'&&event.targetId===downed.id));
  assert.ok(finisherEvents.some(event=>event.type==='finisher'&&event.targetId===downed.id));
  assert.ok(finisherEvents.some(event=>event.type==='enemy-down'&&event.finisher===true));
  assert.equal(downed.dead,true);assert.equal(downed.downed,false);assert.equal(finisherState.defeats,1);
});
