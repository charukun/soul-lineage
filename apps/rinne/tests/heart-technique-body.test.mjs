import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,skillEffects} from '../src/rebuild/domain.js';
import {createFront,tickFront} from '../src/rebuild/combat.js';
import {beginCombatState} from '../src/rebuild/combat-loadout-runtime.js';
import {
  ensureCombatLoadout,learnedHeartSkills,addCombo,setComboSkill,toggleFavored,setActiveCombo,
  setHeartActive,setOneMotion,setBodyChoice,unlockedBodyOptions,requestOneMotion,selectCombatCombo
} from '../src/combat-loadout.js';

function living(){const state=createLife({name:'検証',seed:77});state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.resting=false;return state;}

test('legacy skill weights migrate into one combo while newly learned hearts wait to be set',()=>{
  const state=living();state.knownSkills.push('skill.balance','action.guard-step');state.skillWeights.jo={'action.guard-step':100};ensureCombatLoadout(state);
  assert.equal(state.combatLoadout.technique.combos.length,1);assert.equal(state.combatLoadout.technique.combos[0].slots.jo,'action.guard-step');assert.deepEqual(learnedHeartSkills(state),['skill.balance']);assert.deepEqual(state.combatLoadout.heart.active,['skill.balance']);
  state.knownSkills.push('skill.focus');ensureCombatLoadout(state);assert.equal(state.combatLoadout.heart.active.includes('skill.focus'),false);
});

test('heart page selection controls support effects without changing learned knowledge',()=>{
  const state=living();state.knownSkills.push('skill.focus');ensureCombatLoadout(state);assert.equal(skillEffects(state).damage,0);
  assert.equal(setHeartActive(state,'skill.focus',true),true);assert.ok(skillEffects(state).damage>.05);assert.ok(state.knownSkills.includes('skill.focus'));
  setHeartActive(state,'skill.focus',false);assert.equal(skillEffects(state).damage,0);
});

test('multiple jo-ha-kyu combos can be added and favored tags bias automatic selection',()=>{
  const state=living();state.knownSkills.push('action.guard-step','action.slip','action.lunge');ensureCombatLoadout(state);const first=state.combatLoadout.technique.combos[0],second=addCombo(state);assert.ok(second);
  setComboSkill(state,second.id,'jo','action.guard-step');setComboSkill(state,second.id,'ha','action.slip');setComboSkill(state,second.id,'kyu','action.lunge');toggleFavored(state,second.id,'jo');toggleFavored(state,second.id,'ha');setActiveCombo(state,first.id);
  const combat={comboCursor:0,comboId:null},counts=new Map([[first.id,0],[second.id,0]]);for(let i=0;i<8;i++){const combo=selectCombatCombo(state,combat,{advance:i>0});counts.set(combo.id,counts.get(combo.id)+1);}assert.ok(counts.get(second.id)>counts.get(first.id));
});

test('body options unlock from learned heart skills and can be equipped',()=>{
  const state=living();state.knownSkills.push('skill.balance','skill.distance','skill.breath');ensureCombatLoadout(state);
  assert.ok(unlockedBodyOptions(state,'stance').some(row=>row.id==='chinshin'));assert.ok(unlockedBodyOptions(state,'style').some(row=>row.id==='distance'));assert.ok(unlockedBodyOptions(state,'zanshin').some(row=>row.id==='breath'));
  assert.equal(setBodyChoice(state,'stance','chinshin'),true);assert.equal(setBodyChoice(state,'style','distance'),true);assert.equal(setBodyChoice(state,'zanshin','breath'),true);assert.deepEqual(state.combatLoadout.body,{stance:'chinshin',style:'distance',zanshin:'breath'});
});

test('one-motion attack costs heavy stamina and leaves a long recovery window',()=>{
  const state=living();state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.knownSkills.push('action.guard-step');ensureCombatLoadout(state);setOneMotion(state,'action.guard-step');
  const front=createFront(0,state.seed);front.enemies.forEach((enemy,index)=>{enemy.dead=index!==0;enemy.hp=enemy.maxHp;});front.enemies[0].x=0;front.enemies[0].z=1;state.combat=beginCombatState(state,front.enemies[0].id);assert.equal(requestOneMotion(state),'action.guard-step');
  const before=state.stamina,events=tickFront(state,front,.016);assert.ok(events.some(event=>event.type==='one-motion'));assert.ok(before-state.stamina>=22);assert.ok(state.combat.attackCooldown>1.5);assert.ok(state.combat.zanshinSeconds>.8);
});
