import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {createFront,tickFront} from '../src/rebuild/combat.js';
import {tickLifeBattle} from '../src/rebuild/johakyu-life-battle.js';

function blockedState(){
  const state=createLife({seed:91});
  state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.resting=false;state.stamina=100;state.staminaCap=100;
  state.equipment.weapon='sword';state.knownSkills.push('basic.sword');
  state.combatLoadout={heart:{active:[]},technique:{activeComboId:'combo-1',combos:[{id:'combo-1',name:'基本連',slots:{jo:'basic.sword',ha:'basic.sword',kyu:'basic.sword'},favored:{}}],oneMotion:null},body:{stance:'seigan',style:'balanced',zanshin:'still'}};
  state.injuries.leftArm={severity:.82,at:state.ageSeconds};state.injuries.rightArm={severity:.82,at:state.ageSeconds};
  return state;
}

test('main combat rejects an authored offense when canonical body capability forbids its stage',()=>{
  const state=blockedState(),front=createFront(0,91),enemy=front.enemies[0];
  front.enemies=[enemy];enemy.x=0;enemy.z=1.35;enemy.hp=enemy.maxHp=120;enemy.cooldown=99;
  const startHp=enemy.hp,events=[];
  for(let i=0;i<120&&!events.some(event=>event.type==='execution-blocked');i++)events.push(...tickFront(state,front,1/60));
  const blocked=events.find(event=>event.type==='execution-blocked');
  assert.ok(blocked,'runtime must surface the canonical execution rejection');
  assert.equal(blocked.reason,'arm-injury');assert.equal(blocked.authority,'johakyu-battle');assert.equal(blocked.kind,'slash');
  assert.equal(events.some(event=>event.type==='player-hit'),false);assert.equal(enemy.hp,startHp);
  assert.equal(state.attacking,false);assert.ok(state.combat?.executionBlock?.remaining>0);
});

test('enemy 葬焉 ends a downed life only after the shared finisher completes',()=>{
  const state=blockedState(),front=createFront(0,192),enemy=front.enemies[0];front.enemies=[enemy];enemy.x=0;enemy.z=1.35;enemy.cooldown=0;enemy.hp=enemy.maxHp=300;
  state.injuries.leftArm={severity:0,at:0};state.injuries.rightArm={severity:0,at:0};state.hp=0;state.combat=null;state.down={elapsed:0,rescueSeconds:40,frontier:true};
  const events=[];for(let i=0;i<600&&!state.ended;i++)events.push(...tickLifeBattle([state],front,1/60,{fatalityChance:()=>0}).get(state.id));
  const finisher=events.find(row=>row.type==='enemy-finisher'),ended=events.find(row=>row.type==='life-end'&&row.cause==='enemy-finisher');
  assert.ok(finisher,'an enemy must be able to claim and execute a downed player');assert.ok(ended,'life ends when the enemy finisher completes');assert.equal(state.ended,true);assert.equal(state.down,null);
});
