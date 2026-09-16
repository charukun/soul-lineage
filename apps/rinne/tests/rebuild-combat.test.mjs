import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {createFront,frontierFatalityChance,normalizeFront,tickFront} from '../src/rebuild/combat.js';

function combatState(seed=17){
  const state=createLife({seed});
  state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.resting=false;
  state.equipment.weapon='sword';state.knownSkills.push('basic.sword');state.skillWeights={jo:{'basic.sword':100},ha:{'basic.sword':100},kyu:{'basic.sword':100}};
  return state;
}
function enemy(id,x,z,cooldown=.5){return{id,x,z,hp:100,maxHp:100,dead:false,cooldown,flash:0,yaw:0,attackWindow:0,moving:false};}

test('multi combat advances every living enemy on the same tick',()=>{
  const state=combatState(),front={stage:0,enemies:[enemy('a',2.6,0),enemy('b',-2.6,0),enemy('c',0,-2.6)],cleared:false,clearSeconds:0};
  const before=front.enemies.map(row=>({x:row.x,z:row.z}));
  tickFront(state,front,.1);
  assert.equal(front.enemies.filter((row,index)=>Math.hypot(row.x-before[index].x,row.z-before[index].z)>.001).length,3);
  assert.ok(front.enemies.every(row=>row.moving));
});

test('spatially separated enemies can attack during the same frame',()=>{
  const state=combatState(),radius=1.35;state.stamina=0;
  const front={stage:0,enemies:[enemy('a',0,radius,-.2),enemy('b',Math.sin(2.1)*radius,Math.cos(2.1)*radius,-.2),enemy('c',Math.sin(-2.1)*radius,Math.cos(-2.1)*radius,-.2)],cleared:false,clearSeconds:0};
  const hits=tickFront(state,front,.01).filter(event=>event.type==='enemy-hit');
  assert.ok(hits.length>=2,'separated threats should not be serialized into one attacker');
  assert.equal(new Set(hits.map(event=>event.sourceId)).size,hits.length);
});

test('same-angle enemies yield instead of collapsing into a dogpile',()=>{
  const state=combatState(),radius=1.35;state.stamina=0;
  const front={stage:0,enemies:[enemy('a',0,radius,-.2),enemy('b',Math.sin(.24)*radius,Math.cos(.24)*radius,-.2),enemy('c',4,4,1)],cleared:false,clearSeconds:0};
  const hits=tickFront(state,front,.01).filter(event=>event.type==='enemy-hit');
  assert.equal(hits.length,1);
});

test('jo-ha-kyu can retarget to the more immediate threat mid-sequence',()=>{
  const state=combatState();state.combat={targetId:'a',phase:'kyu',attackCooldown:0};
  const front={stage:0,enemies:[enemy('a',1.25,0,1),enemy('b',0,1.1,-.1),enemy('c',3,3,1)],cleared:false,clearSeconds:0};
  const hit=tickFront(state,front,.05).find(event=>event.type==='player-hit');
  assert.equal(hit?.targetId,'b');
  assert.equal(hit?.phase,'kyu');
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
