import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {createFront,frontierFatalityChance,normalizeFront,tickFront,tickSharedFront} from '../src/rebuild/combat.js';

function combatState(seed=17,id=null){
  const state=createLife({seed});
  if(id)state.id=id;
  state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.resting=false;
  state.equipment.weapon='sword';state.knownSkills.push('basic.sword');state.skillWeights={jo:{'basic.sword':100},ha:{'basic.sword':100},kyu:{'basic.sword':100}};
  return state;
}
function enemy(id,x,z,cooldown=.5){return{id,x,z,hp:100,maxHp:100,dead:false,cooldown,flash:0,yaw:0,attackWindow:0,moving:false};}

test('frontier keeps surrounding enemies spatially active while Tidebreak owns the locked duel',()=>{
  const state=combatState(),front={stage:0,enemies:[enemy('a',1.35,0),enemy('b',-2.6,0),enemy('c',0,-2.6)],cleared:false,clearSeconds:0};
  const before=new Map(front.enemies.map(row=>[row.id,{x:row.x,z:row.z}]));
  tickFront(state,front,.1);
  assert.equal(state.combat?.engine,'tidebreak');
  const unlocked=front.enemies.filter(row=>row.id!==state.combat.targetId);
  assert.ok(unlocked.some(row=>Math.hypot(row.x-before.get(row.id).x,row.z-before.get(row.id).z)>.001));
});

test('a Tidebreak duel keeps its target instead of old mid-combo distance retargeting',()=>{
  const state=combatState(),front={stage:0,enemies:[enemy('a',1.25,0),enemy('b',2.4,0),enemy('c',3,3)],cleared:false,clearSeconds:0};
  tickFront(state,front,.05);const locked=state.combat?.targetId;assert.equal(locked,'a');
  front.enemies.find(row=>row.id==='b').x=.55;front.enemies.find(row=>row.id==='b').z=0;
  tickFront(state,front,.05);
  assert.equal(state.combat?.targetId,locked);
  assert.equal(state.combat?.engine,'tidebreak');
});

test('Tidebreak exchanges expose the existing Rinne combat-event contract',()=>{
  const state=combatState(44),front={stage:0,enemies:[enemy('a',0,1.25,0)],cleared:false,clearSeconds:0};let events=[];
  for(let i=0;i<360&&!state.down&&!state.ended&&!front.enemies[0].dead;i++)events.push(...tickFront(state,front,1/60));
  const event=events.find(row=>['player-hit','enemy-hit','evaded','enemy-down','downed','life-end'].includes(row.type));
  assert.ok(event);assert.equal(event.engine,'tidebreak');
});

test('shared frontier assigns each enemy to one authoritative Tidebreak owner',()=>{
  const left=combatState(51,'left'),right=combatState(52,'right');left.position={x:-1,z:0};right.position={x:1,z:0};
  const front={stage:0,enemies:[enemy('a',-1,1.2,0),enemy('b',1,1.2,0)],cleared:false,clearSeconds:0};
  tickSharedFront([right,left],front,.05);
  assert.equal(left.combat?.engine,'tidebreak');assert.equal(right.combat?.engine,'tidebreak');
  assert.notEqual(left.combat?.targetId,right.combat?.targetId);
});

test('armor and survival skills lower frontier fatality instead of only changing HP',()=>{
  const base=combatState(71),survivor=combatState(72);survivor.equipment.armor='heavy';survivor.equipment.shield=true;survivor.knownSkills.push('skill.balance','skill.adapt','skill.danger','skill.care','action.guard-step');
  assert.ok(frontierFatalityChance(base)>=.8);assert.ok(frontierFatalityChance(survivor)<frontierFatalityChance(base));
});

test('legacy frontier saves gain tactical fields without migration failure',()=>{
  const raw=createFront(0,1);
  for(const row of raw.enemies){delete row.yaw;delete row.attackWindow;delete row.moving;}
  const normalized=normalizeFront(raw,0,1);
  assert.ok(normalized.enemies.every(row=>Number.isFinite(row.yaw)&&row.attackWindow===0&&row.moving===false));
});
