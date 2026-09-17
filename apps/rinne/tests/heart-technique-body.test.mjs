import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,skillEffects} from '../src/rebuild/domain.js';
import {createFront,tickFront} from '../src/rebuild/combat.js';
import {beginCombatState} from '../src/rebuild/combat-loadout-runtime.js';
import {
  ensureCombatLoadout,learnedHeartSkills,learnedTechniqueSkills,addCombo,setComboSkill,toggleFavored,setActiveCombo,
  setHeartActive,setOneMotion,setBodyChoice,unlockedBodyOptions,requestOneMotion,selectCombatCombo
} from '../src/combat-loadout.js';

function living(){const state=createLife({name:'検証',seed:77});state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.resting=false;return state;}

test('heart technique and body choices are available without learned progression',()=>{
  const state=living();ensureCombatLoadout(state);
  assert.ok(learnedHeartSkills(state).includes('skill.balance'));
  assert.ok(learnedHeartSkills(state).includes('skill.focus'));
  assert.ok(learnedTechniqueSkills(state).includes('action.guard-step'));
  assert.deepEqual(state.combatLoadout.heart.active,[]);
});

test('heart page selection controls an immediate tactical effect without changing knowledge',()=>{
  const state=living();ensureCombatLoadout(state);const before=[...state.knownSkills];assert.equal(skillEffects(state).damage,0);
  assert.equal(setHeartActive(state,'skill.focus',true),true);assert.ok(skillEffects(state).damage>.05);assert.deepEqual(state.knownSkills,before);
  setHeartActive(state,'skill.focus',false);assert.equal(skillEffects(state).damage,0);
});

test('weapon change normalizes stale legacy basic skills to the equipped weapon',()=>{
  const state=living();state.equipment.weapon='sword';state.skillWeights={jo:{'basic.fist':100},ha:{},kyu:{}};ensureCombatLoadout(state);
  assert.equal(state.combatLoadout.technique.combos[0].slots.jo,'basic.sword');assert.equal(state.skillWeights.jo['basic.sword'],100);
});

test('multiple jo-ha-kyu combos can use any authored action from the start',()=>{
  const state=living();ensureCombatLoadout(state);const first=state.combatLoadout.technique.combos[0],second=addCombo(state);assert.ok(second);
  assert.equal(setComboSkill(state,second.id,'jo','action.guard-step'),true);assert.equal(setComboSkill(state,second.id,'ha','action.slip'),true);assert.equal(setComboSkill(state,second.id,'kyu','action.lunge'),true);
  toggleFavored(state,second.id,'jo');toggleFavored(state,second.id,'ha');setActiveCombo(state,first.id);
  const combat={comboCursor:0,comboId:null},counts=new Map([[first.id,0],[second.id,0]]);for(let i=0;i<8;i++){const combo=selectCombatCombo(state,combat,{advance:i>0});counts.set(combo.id,counts.get(combo.id)+1);}assert.ok(counts.get(second.id)>counts.get(first.id));
});

test('all body options are tactical choices rather than unlock rewards',()=>{
  const state=living();ensureCombatLoadout(state);
  assert.ok(unlockedBodyOptions(state,'stance').some(row=>row.id==='chinshin'));assert.ok(unlockedBodyOptions(state,'style').some(row=>row.id==='distance'));assert.ok(unlockedBodyOptions(state,'zanshin').some(row=>row.id==='breath'));
  assert.equal(setBodyChoice(state,'stance','chinshin'),true);assert.equal(setBodyChoice(state,'style','distance'),true);assert.equal(setBodyChoice(state,'zanshin','breath'),true);assert.deepEqual(state.combatLoadout.body,{stance:'chinshin',style:'distance',zanshin:'breath'});
});

test('one-motion attack is selectable without progression and still costs heavy stamina',()=>{
  const state=living();state.zone='frontier';state.position={x:0,z:0};state.yaw=0;ensureCombatLoadout(state);assert.equal(setOneMotion(state,'action.guard-step'),true);
  const front=createFront(0,state.seed);front.enemies.forEach((enemy,index)=>{enemy.dead=index!==0;enemy.hp=enemy.maxHp;});front.enemies[0].x=0;front.enemies[0].z=1;state.combat=beginCombatState(state,front.enemies[0].id);assert.equal(requestOneMotion(state),'action.guard-step');
  const before=state.stamina,events=tickFront(state,front,.016);assert.ok(events.some(event=>event.type==='one-motion'));assert.ok(before-state.stamina>=22);assert.ok(state.combat.attackCooldown>1.5);assert.ok(state.combat.zanshinSeconds>.8);
});
