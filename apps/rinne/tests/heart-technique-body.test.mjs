import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,skillEffects} from '../src/rebuild/domain.js';
import {createFront,tickFront} from '../src/rebuild/combat.js';
import {beginCombatState,combatSkill} from '../src/rebuild/combat-loadout-runtime.js';
import {
  ensureCombatLoadout,learnedHeartSkills,learnedTechniques,setTechniqueIntentSlot,
  setOneMotion,setBodyChoice,unlockedBodyOptions,learnedBodySkills,requestOneMotion,selectCombatCombo
} from '../src/combat-loadout.js';

function living(){const state=createLife({name:'検証',seed:77});state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.resting=false;return state;}

test('learned heart skills are passive knowledge and never require an active toggle',()=>{
  const state=living();state.knownSkills.push('skill.balance','skill.focus');ensureCombatLoadout(state);
  assert.deepEqual(learnedHeartSkills(state),['skill.balance','skill.focus']);assert.deepEqual(state.combatLoadout.heart.active,['skill.balance','skill.focus']);
  const effects=skillEffects(state);assert.ok(effects.damage>.05);assert.ok(effects.mitigation>.04);
  state.combatLoadout.heart.active=[];assert.ok(skillEffects(state).damage>.05,'legacy active array must not suppress learned knowledge');
});

test('an inspired action unlocks one named jo-ha-kyu technique',()=>{
  const state=living();state.equipment.weapon='sword';state.knownSkills.push('basic.sword','action.guard-step');ensureCombatLoadout(state);
  const rows=learnedTechniques(state),learned=rows.find(row=>row.id==='tech.guard-flow');assert.ok(learned);assert.equal(learned.name,'受け流しの型');
  assert.deepEqual(learned.slots,{jo:'basic.sword',ha:'action.guard-step',kyu:'action.guard-step'});assert.equal(state.combatLoadout.technique.intentSlots[0],'tech.guard-flow');
});

test('three intent slots accept learned named techniques and drive automatic combat in slot order',()=>{
  const state=living();state.equipment.weapon='sword';state.knownSkills.push('basic.sword','action.guard-step','action.slip','action.lunge');ensureCombatLoadout(state);
  assert.equal(setTechniqueIntentSlot(state,0,'tech.guard-flow'),true);assert.equal(setTechniqueIntentSlot(state,1,'tech.hien'),true);assert.equal(setTechniqueIntentSlot(state,2,'tech.iwato'),true);
  const combat={comboCursor:0,comboId:null},seen=[];for(let i=0;i<4;i++)seen.push(selectCombatCombo(state,combat,{advance:i>0}).id);assert.deepEqual(seen,['tech.guard-flow','tech.hien','tech.iwato','tech.guard-flow']);
  state.combat=beginCombatState(state,'enemy');assert.equal(combatSkill(state,'jo'),'basic.sword');assert.equal(combatSkill(state,'ha'),'action.guard-step');
});

test('legacy saves stay valid while gaining the new intent slot representation',()=>{
  const state=living();state.equipment.weapon='sword';state.knownSkills.push('basic.sword','action.guard-step');state.skillWeights={jo:{'action.guard-step':100},ha:{},kyu:{}};state.combatLoadout={technique:{combos:[{id:'combo-legacy',name:'旧連技',slots:{jo:'action.guard-step',ha:'basic.sword',kyu:'basic.sword'},favored:{}}],activeComboId:'combo-legacy'}};
  ensureCombatLoadout(state);assert.equal(state.combatLoadout.technique.combos[0].id,'combo-legacy');assert.equal(state.combatLoadout.technique.intentSlots.length,3);assert.ok(state.combatLoadout.technique.intentSlots[0]);assert.doesNotThrow(()=>structuredClone(state));
});

test('body skills expose stance distance zanshin categories and can be equipped',()=>{
  const state=living();state.knownSkills.push('skill.balance','skill.distance','skill.breath','skill.flow-step','skill.soft-step');ensureCombatLoadout(state);
  assert.ok(unlockedBodyOptions(state,'stance').some(row=>row.id==='chinshin'));assert.ok(unlockedBodyOptions(state,'style').some(row=>row.id==='distance'));assert.ok(unlockedBodyOptions(state,'zanshin').some(row=>row.id==='breath'));
  const learned=learnedBodySkills(state);assert.ok(learned.some(row=>row.category==='構え'));assert.ok(learned.some(row=>row.category==='間合い'));assert.ok(learned.some(row=>row.category==='残心'));
  assert.equal(setBodyChoice(state,'stance','chinshin'),true);assert.equal(setBodyChoice(state,'style','distance'),true);assert.equal(setBodyChoice(state,'zanshin','breath'),true);assert.deepEqual(state.combatLoadout.body,{stance:'chinshin',style:'distance',zanshin:'breath'});
});

test('one-motion remains a costly manual override while automatic combo slots stay primary',()=>{
  const state=living();state.zone='frontier';state.position={x:0,z:0};state.yaw=0;state.knownSkills.push('action.guard-step');ensureCombatLoadout(state);setOneMotion(state,'action.guard-step');
  const front=createFront(0,state.seed);front.enemies.forEach((enemy,index)=>{enemy.dead=index!==0;enemy.hp=enemy.maxHp;});front.enemies[0].x=0;front.enemies[0].z=1;state.combat=beginCombatState(state,front.enemies[0].id);assert.equal(requestOneMotion(state),'action.guard-step');
  const before=state.stamina,events=tickFront(state,front,.016);assert.ok(events.some(event=>event.type==='one-motion'));assert.ok(before-state.stamina>=22);assert.ok(state.combat.attackCooldown>1.5);assert.ok(state.combat.zanshinSeconds>.8);
});
