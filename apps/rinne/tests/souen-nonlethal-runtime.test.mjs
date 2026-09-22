import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {combatFinisherRuntime,ensureCombatLoadout,setBodyChoice,setHeartActive} from '../src/combat-loadout.js';
import {createFront,tickFront} from '../src/rebuild/combat.js';

function stateFor(seed=91){
  const state=createLife({seed});state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.resting=false;
  state.equipment.weapon='sword';state.knownSkills.push('basic.sword','skill.nonlethal','skill.edge');state.inspiration.legacySkills.push('skill.nonlethal','skill.edge');
  state.skillWeights={jo:{'basic.sword':100},ha:{'basic.sword':100},kyu:{'basic.sword':100}};state.combatLoadout=null;ensureCombatLoadout(state);return state;
}
function enableNonlethal(state){assert.equal(setHeartActive(state,'skill.nonlethal',true),true);}

test('不殺は最後のダウンを殺害せず前線制圧として完了する',()=>{
  const state=stateFor();enableNonlethal(state);const front=createFront(0,91);
  front.enemies.forEach((row,index)=>{row.dead=index!==0;row.downed=index===0;row.downedElapsed=index===0?.2:0;row.hp=index===0?0:row.hp;});
  const events=tickFront(state,front,1/60);
  assert.equal(front.cleared,true);assert.equal(front.enemies[0].dead,false);
  assert.ok(events.some(row=>row.type==='front-cleared'&&row.nonlethal===true));assert.ok(!events.some(row=>row.type==='finisher-start'));
});

test('不殺で残したダウン敵は戦闘継続中なら再起する',()=>{
  const state=stateFor(92);enableNonlethal(state);const front=createFront(0,92),downed=front.enemies[0],active=front.enemies[1];
  front.enemies.slice(2).forEach(row=>{row.dead=true;});downed.downed=true;downed.downedElapsed=20;downed.hp=0;active.x=4.6;active.z=4.6;
  const events=tickFront(state,front,1/60);
  assert.equal(downed.downed,false);assert.ok(downed.hp>0);assert.ok(events.some(row=>row.type==='enemy-recovered'&&row.targetId===downed.id));
});

test('葬焉はトドメの型であり、不殺は選択を保持したまま実行だけ止める',()=>{
  const state=stateFor(93);assert.equal(setBodyChoice(state,'finisher','sokudan'),true);
  let policy=combatFinisherRuntime(state);assert.equal(policy.finisher.id,'sokudan');assert.equal(policy.execute,true);
  enableNonlethal(state);policy=combatFinisherRuntime(state);
  assert.equal(policy.finisher.id,'sokudan');assert.equal(policy.nonlethal,true);assert.equal(policy.execute,false);
});
