import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {ensureCombatLoadout,setHeartActive} from '../src/combat-loadout.js';
import {createFront,frontierFatalityChance,normalizeFront,tickFront,tickSharedFront} from '../src/rebuild/combat.js';

function combatState(seed=17,id=null){
  const state=createLife({seed});if(id)state.id=id;
  state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.resting=false;
  state.equipment.weapon='sword';state.knownSkills.push('basic.sword');state.skillWeights={jo:{'basic.sword':100},ha:{'basic.sword':100},kyu:{'basic.sword':100}};return state;
}
function enemy(id,x,z,cooldown=.5,hp=100){return{id,x,z,hp,maxHp:hp,dead:false,cooldown,flash:0,yaw:0,attackWindow:0,moving:false};}

test('frontier keeps surrounding enemies spatially active while Tidebreak owns the primary exchange',()=>{
  const state=combatState(),front={stage:0,enemies:[enemy('a',1.35,0),enemy('b',-2.6,0),enemy('c',0,-2.6)],cleared:false,clearSeconds:0};const before=new Map(front.enemies.map(row=>[row.id,{x:row.x,z:row.z}]));tickFront(state,front,.1);assert.equal(state.combat?.engine,'tidebreak');const unlocked=front.enemies.filter(row=>row.id!==state.combat.targetId);assert.ok(unlocked.some(row=>Math.hypot(row.x-before.get(row.id).x,row.z-before.get(row.id).z)>.001));
});

test('a Tidebreak primary keeps its target instead of old mid-combo distance retargeting',()=>{
  const state=combatState(),front={stage:0,enemies:[enemy('a',1.25,0),enemy('b',2.4,0),enemy('c',3,3)],cleared:false,clearSeconds:0};tickFront(state,front,.05);const locked=state.combat?.targetId;assert.equal(locked,'a');front.enemies.find(row=>row.id==='b').x=.55;front.enemies.find(row=>row.id==='b').z=0;tickFront(state,front,.05);assert.equal(state.combat?.targetId,locked);assert.equal(state.combat?.engine,'tidebreak');
});

test('one player can be engaged by several Tidebreak threats at once',()=>{
  const state=combatState(33),r=1.25,front={stage:0,enemies:[enemy('a',0,r,0,300),enemy('b',Math.sin(2.1)*r,Math.cos(2.1)*r,0,300),enemy('c',Math.sin(-2.1)*r,Math.cos(-2.1)*r,0,300)],cleared:false,clearSeconds:0};state.hp=state.maxHp=500;tickFront(state,front,1/60);assert.equal(state.combat?.engine,'tidebreak');assert.ok(state.combat?.threatIds?.length>=3,'primary plus nearby threats should all stay engaged');const sources=new Set();for(let i=0;i<480&&!state.down&&!state.ended;i++)for(const event of tickFront(state,front,1/60))if(event.type==='enemy-hit')sources.add(event.sourceId);assert.ok(sources.size>=2,'multiple enemies should be able to attack the same player');
});

test('critical stamina switches the body to recovery rather than free offensive attacks',()=>{
  const state=combatState(34),foe=enemy('a',0,1.2,0,500),front={stage:0,enemies:[foe],cleared:false,clearSeconds:0};state.hp=state.maxHp=500;state.stamina=2;state.staminaCap=100;const events=[];for(let i=0;i<120&&!state.down&&!state.ended;i++)events.push(...tickFront(state,front,1/60));assert.equal(state.combat?.staminaBand,'critical');assert.equal(state.combat?.bodyIntent,'recover');assert.equal(events.some(row=>row.type==='player-hit'&&['jo','ha','kyu'].includes(row.phase)),false,'critical stamina must not execute normal offense');
});

test('primary Tidebreak pair exposes exchange interpretation without removing secondary threats',()=>{
  const state=combatState(135),r=1.25,front={stage:0,enemies:[enemy('a',0,r,0,500),enemy('b',Math.sin(2.1)*r,Math.cos(2.1)*r,0,500),enemy('c',Math.sin(-2.1)*r,Math.cos(-2.1)*r,0,500)],cleared:false,clearSeconds:0};state.hp=state.maxHp=500;
  for(let i=0;i<180&&!state.combat?.exchange;i++)tickFront(state,front,1/60);
  assert.ok(state.combat?.exchange,'primary pair must expose the shared exchange interpretation');assert.ok(['read','pressure','reversal','zanshin'].includes(state.combat.exchange.mode));
  assert.ok(state.combat.threatIds.length>=3,'pair exchange must not lock out flank/support threats');assert.equal('damage' in state.combat.exchange,false);assert.equal('slot' in state.combat.exchange,false);
});

test('Tidebreak combat snapshot is exposed to the Rinne renderer from the same exchange',()=>{
  const state=combatState(35),front={stage:0,enemies:[enemy('a',0,1.2,0,500)],cleared:false,clearSeconds:0};for(let i=0;i<180&&!state.combat?.tidebreakPose?.attack;i++)tickFront(state,front,1/60);assert.equal(state.combat?.engine,'tidebreak');assert.ok(state.combat?.tidebreakPose);assert.equal(state.combat.tidebreakPose.targetId,'a');assert.ok(Number.isFinite(state.combat.tidebreakPose.progress));
});

test('Tidebreak exchanges expose the existing Rinne combat-event contract',()=>{
  const state=combatState(44),front={stage:0,enemies:[enemy('a',0,1.25,0)],cleared:false,clearSeconds:0};let events=[];for(let i=0;i<360&&!state.down&&!state.ended&&!front.enemies[0].dead;i++)events.push(...tickFront(state,front,1/60));const event=events.find(row=>['player-hit','enemy-hit','evaded','enemy-down','downed','life-end'].includes(row.type));assert.ok(event);assert.equal(event.engine,'tidebreak');
});

test('shared frontier lets several players fight and damage the same attended enemy',()=>{
  const left=combatState(51,'left'),right=combatState(52,'right');left.position={x:-.35,z:0};right.position={x:.35,z:0};left.hp=left.maxHp=500;right.hp=right.maxHp=500;const shared=enemy('shared',0,1.2,0,1000),front={stage:0,enemies:[shared],cleared:false,clearSeconds:0},hits=new Map([['left',0],['right',0]]);for(let i=0;i<420&&!shared.dead;i++){const events=tickSharedFront([right,left],front,1/60);for(const [id,rows]of events)hits.set(id,hits.get(id)+rows.filter(row=>row.type==='player-hit'&&row.targetId==='shared').length);}assert.equal(left.combat?.targetId,'shared');assert.equal(right.combat?.targetId,'shared');assert.ok(['left','right'].includes(shared.attentionTargetId));assert.ok(hits.get('left')>0&&hits.get('right')>0,'attention must not prevent either player damaging shared HP');assert.ok(shared.hp<shared.maxHp);
});

test('enemy attention may converge on one player without assigning combat ownership',()=>{
  const focus=combatState(61,'focus'),other=combatState(62,'other');focus.position={x:0,z:0};other.position={x:4.5,z:0};focus.hp=30;focus.maxHp=100;const front={stage:0,enemies:[enemy('a',-.5,1.1,0,400),enemy('b',.5,1.1,0,400),enemy('c',0,1.5,0,400)],cleared:false,clearSeconds:0};tickSharedFront([other,focus],front,1/60);assert.ok(front.enemies.filter(row=>row.attentionTargetId==='focus').length>=2,'several enemies may choose the same vulnerable player');
});

test('armor and survival skills lower frontier fatality instead of only changing HP',()=>{
  const base=combatState(71),survivor=combatState(72);survivor.equipment.armor='heavy';survivor.equipment.shield=true;survivor.knownSkills.push('skill.balance','skill.adapt','skill.danger','skill.care','action.guard-step');assert.ok(frontierFatalityChance(base)>=.8);assert.ok(frontierFatalityChance(survivor)<frontierFatalityChance(base));
});

test('legacy frontier saves gain tactical fields without migration failure',()=>{
  const raw=createFront(0,1);for(const row of raw.enemies){delete row.yaw;delete row.attackWindow;delete row.moving;delete row.attentionTargetId;delete row.threat;}const normalized=normalizeFront(raw,0,1);assert.ok(normalized.enemies.every(row=>Number.isFinite(row.yaw)&&row.attackWindow===0&&row.moving===false&&row.attentionTargetId===null&&typeof row.threat==='object'));
});


function equipNonlethal(state){state.inspiration.legacySkills.push('skill.nonlethal');state.knownSkills.push('skill.nonlethal');state.combatLoadout=null;ensureCombatLoadout(state);assert.equal(setHeartActive(state,'skill.nonlethal',true),true);}

test('不殺は最後のダウンを殺害なしの前線制圧として完了する',()=>{
  const state=combatState(91);equipNonlethal(state);const front=createFront(0,91);front.enemies.forEach((row,index)=>{row.dead=index!==0;row.downed=index===0;row.downedElapsed=index===0?.2:0;row.hp=index===0?0:row.hp;});
  const events=tickFront(state,front,1/60);assert.equal(front.cleared,true);assert.equal(front.enemies[0].dead,false);assert.ok(events.some(row=>row.type==='front-cleared'&&row.nonlethal===true));assert.ok(!events.some(row=>row.type==='finisher-start'));
});

test('不殺で残したダウン敵は戦闘継続中なら再起する',()=>{
  const state=combatState(92);equipNonlethal(state);const front=createFront(0,92),downed=front.enemies[0],active=front.enemies[1];front.enemies.slice(2).forEach(row=>{row.dead=true;});downed.downed=true;downed.downedElapsed=20;downed.hp=0;active.x=4.6;active.z=4.6;const events=tickFront(state,front,1/60);
  assert.equal(downed.downed,false);assert.ok(downed.hp>0);assert.ok(events.some(row=>row.type==='enemy-recovered'&&row.targetId===downed.id));
});
