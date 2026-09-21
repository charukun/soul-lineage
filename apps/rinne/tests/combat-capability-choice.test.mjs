import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {ensureCombatLoadout} from '../src/combat-loadout.js';
import {resolveCapabilityTechniqueChoice} from '../src/rebuild/combat-core.js';

function state(){
  const s=createLife({seed:117});Object.assign(s,{phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0},stamina:100,staminaCap:100});
  s.equipment.weapon='sword';s.inspiration.legacySkills.push('action.side-step','action.recover');s.knownSkills.push('basic.sword','action.side-step','action.recover');s.combatCatalog=['action.side-step','action.recover'];
  s.combatLoadout={heart:{active:[]},technique:{activeComboId:'combo-1',combos:[
    {id:'combo-1',name:'流動連',slots:{jo:'action.side-step',ha:'basic.sword',kyu:'basic.sword'},favored:{jo:true}},
    {id:'combo-2',name:'立直連',slots:{jo:'action.recover',ha:'basic.sword',kyu:'basic.sword'},favored:{}}
  ],oneMotion:null},body:{stance:'seigan',style:'balanced',zanshin:'still'}};
  ensureCombatLoadout(s);s.combat={targetId:'foe',phase:'jo',comboId:'combo-1',comboCursor:0,attackCooldown:0};return s;
}

test('combat choice keeps the configured technique when the body can complete it',()=>{
  const s=state(),choice=resolveCapabilityTechniqueChoice(s,{id:'foe'});
  assert.equal(choice.ok,true);assert.equal(choice.comboId,'combo-1');assert.equal(choice.techniqueId,'action.side-step');assert.equal(choice.adapted,false);
});

test('combat choice switches only to another configured combo when injury makes the preferred technique impossible',()=>{
  const s=state();s.injuries.leftLeg={severity:.82,at:s.ageSeconds};s.injuries.rightLeg={severity:.1,at:s.ageSeconds};
  const choice=resolveCapabilityTechniqueChoice(s,{id:'foe'});
  assert.equal(choice.ok,true);assert.equal(choice.comboId,'combo-2');assert.equal(choice.techniqueId,'action.recover');assert.equal(choice.adapted,true);
  assert.equal(choice.attempts[0].comboId,'combo-1');assert.equal(choice.attempts[0].reason,'leg-injury');assert.equal(choice.capability.canContinue,true);
});

test('combat choice fails closed so tactics can recover when no configured technique is physically executable',()=>{
  const s=state();s.injuries.leftLeg={severity:.82,at:s.ageSeconds};s.injuries.rightLeg={severity:.84,at:s.ageSeconds};
  const choice=resolveCapabilityTechniqueChoice(s,{id:'foe'});
  assert.equal(choice.ok,false);assert.equal(choice.comboId,null);assert.equal(choice.reason,'leg-injury');
  assert.equal(choice.attempts.every(row=>row.canContinue===false),true);
});
