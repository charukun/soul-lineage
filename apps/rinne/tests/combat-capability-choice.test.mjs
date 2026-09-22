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
  assert.equal(choice.ok,false);assert.equal(choice.comboId,null);assert.equal(choice.reason,'incapacitated');
  assert.equal(choice.attempts.every(row=>row.canContinue===false),true);
});

function equipmentState({weapon='sword',armor='cloth',stamina=100}={}){
  const s=createLife({seed:231});Object.assign(s,{phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0},stamina,staminaCap:100});
  s.equipment.weapon=weapon;s.equipment.armor=armor;s.knownSkills.push('basic.'+weapon);
  s.combatLoadout={heart:{active:[]},technique:{activeComboId:'combo-1',combos:[{id:'combo-1',name:'装備試験',slots:{jo:'basic.'+weapon,ha:'basic.'+weapon,kyu:'basic.'+weapon},favored:{}}],oneMotion:null},body:{stance:'seigan',style:'balanced',zanshin:'still'}};
  ensureCombatLoadout(s);s.combat={targetId:'foe',phase:'jo',comboId:'combo-1',comboCursor:0,attackCooldown:0};return s;
}

test('two-handed weapons require both functional arms while one-handed sword remains usable',()=>{
  const great=equipmentState({weapon:'great'});great.injuries.leftArm={severity:.82,at:great.ageSeconds};great.injuries.rightArm={severity:.1,at:great.ageSeconds};
  const blocked=resolveCapabilityTechniqueChoice(great,{id:'foe'});
  assert.equal(blocked.ok,false);assert.equal(blocked.reason,'arm-injury');assert.equal(blocked.attempts[0].canContinue,false);
  const sword=equipmentState({weapon:'sword'});sword.injuries.leftArm={severity:.82,at:sword.ageSeconds};sword.injuries.rightArm={severity:.1,at:sword.ageSeconds};
  const allowed=resolveCapabilityTechniqueChoice(sword,{id:'foe'});
  assert.equal(allowed.ok,true);assert.equal(allowed.capability.stages[0].equipment.requiresTwoHands,false);
});

test('armor stamina scale changes whether the configured technique can be completed',()=>{
  const cloth=equipmentState({weapon:'sword',armor:'cloth',stamina:34}),heavy=equipmentState({weapon:'sword',armor:'heavy',stamina:34});
  const lightChoice=resolveCapabilityTechniqueChoice(cloth,{id:'foe'}),heavyChoice=resolveCapabilityTechniqueChoice(heavy,{id:'foe'});
  assert.equal(lightChoice.ok,true);
  assert.equal(heavyChoice.ok,false);assert.equal(heavyChoice.reason,'stamina-policy');
  assert.ok(heavyChoice.attempts[0].canContinue===false);
});


function exchangeState(){
  const s=createLife({seed:412});Object.assign(s,{id:'hero-exchange',phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0},stamina:100,staminaCap:100});
  s.equipment.weapon='sword';s.inspiration.legacySkills.push('action.recover');s.knownSkills.push('basic.sword','action.recover');s.combatCatalog=['action.recover'];
  s.combatLoadout={heart:{active:[]},technique:{activeComboId:'combo-pressure',combos:[
    {id:'combo-pressure',name:'攻め連',slots:{jo:'basic.sword',ha:'basic.sword',kyu:'basic.sword'},favored:{}},
    {id:'combo-recover',name:'受け連',slots:{jo:'action.recover',ha:'action.recover',kyu:'action.recover'},favored:{}}
  ],oneMotion:null},body:{stance:'seigan',style:'balanced',zanshin:'still'}};
  ensureCombatLoadout(s);s.combat={targetId:'foe',phase:'jo',comboId:'combo-recover',comboCursor:0,attackCooldown:0};return s;
}

test('strong-parry reversal makes initiative favor a configured attacking technique over passive recovery',()=>{
  const s=exchangeState();s.combat.exchange={mode:'reversal',initiativeId:s.id,responderId:'foe',serial:2,pressureCount:1,lastPhase:'ha',lastReason:'strong-parry',continuity:'reverse'};
  const choice=resolveCapabilityTechniqueChoice(s,{id:'foe',x:0,z:1.45,attackWindow:0,cooldown:.6});
  assert.equal(choice.ok,true);assert.equal(choice.comboId,'combo-pressure');assert.equal(choice.techniqueId,'basic.sword');assert.equal(choice.adapted,true);
  const attack=choice.attempts.find(row=>row.comboId==='combo-pressure'),recover=choice.attempts.find(row=>row.comboId==='combo-recover');
  assert.ok(attack.exchangeScore>recover.exchangeScore);assert.ok(attack.exchangeScore>0);
});

test('being responder under pressure favors configured guard and spacing instead of forcing offense',()=>{
  const s=exchangeState();s.combat.comboId='combo-pressure';s.combat.exchange={mode:'pressure',initiativeId:'foe',responderId:s.id,serial:3,pressureCount:2,lastPhase:'ha',lastReason:'commit',continuity:'pressure'};
  const choice=resolveCapabilityTechniqueChoice(s,{id:'foe',x:0,z:1.45,attackWindow:0,cooldown:.6});
  assert.equal(choice.ok,true);assert.equal(choice.comboId,'combo-recover');assert.equal(choice.techniqueId,'action.recover');assert.equal(choice.adapted,true);
  const attack=choice.attempts.find(row=>row.comboId==='combo-pressure'),recover=choice.attempts.find(row=>row.comboId==='combo-recover');
  assert.ok(recover.exchangeScore>attack.exchangeScore);assert.ok(recover.exchangeScore>0);
});
