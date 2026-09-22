import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,tickLife} from '../src/rebuild/domain.js';
import {SUPPORT_SKILLS,ACTION_SKILLS,eligibleDiscoveries,skillEffects} from '../src/rebuild/skill-system.js';
import {ensureCombatLoadout,setHeartActive,setComboSkill} from '../src/combat-loadout.js';

function living(seed=1){const state=createLife({seed});state.phase='living';state.ageYears=10;state.ageSeconds=600;state.resting=false;return state;}
function completeActivity(state,station){for(let i=0;i<33;i++)tickLife(state,{realDelta:.25,station});}

test('combat catalog remains broad without being a progression tree',()=>{
  assert.ok(SUPPORT_SKILLS.length>=28);
  assert.ok(SUPPORT_SKILLS.length>ACTION_SKILLS.length);
  assert.ok(ACTION_SKILLS.length>=12);
});

test('life activities can be recorded without unlocking character power',()=>{
  const state=living(11),before=[...state.knownSkills],station={id:'room.bed',label:'ベッド',activity:'breathe',actionLabel:'寝床で呼吸を整える'};
  completeActivity(state,station);
  assert.ok(state.experiences.breathe.score>0);
  assert.deepEqual(state.knownSkills,before);
  assert.deepEqual(eligibleDiscoveries(state),[]);
});

test('experience totals never change combat effects',()=>{
  const state=living(12);ensureCombatLoadout(state);const before=skillEffects(state);
  state.experiences.practice={count:999,score:999,last:0};state.experiences.combat={count:999,score:999,last:0};
  assert.deepEqual(skillEffects(state),before);
});

test('heart choices are available immediately and only selected choices apply',()=>{
  const state=living(13);ensureCombatLoadout(state);assert.equal(skillEffects(state).damage,0);
  assert.equal(setHeartActive(state,'skill.focus',true),true);assert.ok(skillEffects(state).damage>.05);
  assert.equal(setHeartActive(state,'skill.focus',false),true);assert.equal(skillEffects(state).damage,0);
});

test('action choices are available immediately instead of being learned',()=>{
  const state=living(14);ensureCombatLoadout(state);const combo=state.combatLoadout.technique.combos[0];
  assert.equal(setComboSkill(state,combo.id,'jo','action.lunge'),true);
  const effects=skillEffects(state);assert.ok(effects.reach>=.12);assert.ok(effects.damage>=.06);
  state.experiences.practice={count:50,score:50,last:0};assert.deepEqual(skillEffects(state),effects);
});
