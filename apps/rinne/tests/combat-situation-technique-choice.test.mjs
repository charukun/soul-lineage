import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {ensureCombatLoadout} from '../src/combat-loadout.js';
import {selectCapableTidebreakCombo} from '../src/rebuild/tidebreak-loadout.js';

function configuredState({first,second,heart=[]}){
  const s=createLife({seed:404});Object.assign(s,{phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0},stamina:100,staminaCap:100});
  s.equipment.weapon='sword';
  const skills=[first,second,...heart];
  s.inspiration.legacySkills.push(...skills);s.knownSkills.push('basic.sword',...skills);s.combatCatalog=[...skills];
  s.combatLoadout={heart:{active:[...heart]},technique:{activeComboId:'combo-1',combos:[
    {id:'combo-1',name:'第一候補',slots:{jo:first,ha:'basic.sword',kyu:'basic.sword'},favored:{}},
    {id:'combo-2',name:'第二候補',slots:{jo:second,ha:'basic.sword',kyu:'basic.sword'},favored:{}}
  ],oneMotion:null},body:{stance:'seigan',style:'balanced',zanshin:'still'}};
  ensureCombatLoadout(s);s.combat={targetId:'foe',phase:'jo',comboId:'combo-1',comboCursor:0,attackCooldown:0};return s;
}

test('live distance can override the preferred combo only with another configured executable technique',()=>{
  const s=configuredState({first:'action.recover',second:'action.precision'});
  const target={id:'foe',x:0,z:3.4,attackWindow:0,cooldown:1,dead:false};
  const choice=selectCapableTidebreakCombo(s,{phase:'jo',comboId:'combo-1',target});
  assert.equal(choice.ok,true);assert.equal(choice.comboId,'combo-2');assert.equal(choice.techniqueId,'action.precision');assert.equal(choice.adapted,true);
  const recover=choice.attempts.find(row=>row.comboId==='combo-1'),precision=choice.attempts.find(row=>row.comboId==='combo-2');
  assert.equal(recover.canContinue,true);assert.equal(precision.canContinue,true);
  assert.ok(precision.situationScore>recover.situationScore);assert.ok(precision.score>recover.score);
});

test('incoming commitment plus heart reading favors a configured counter technique',()=>{
  const s=configuredState({first:'action.crash',second:'action.counter',heart:['skill.read','skill.patience']});
  const target={id:'foe',x:0,z:1.4,attackWindow:.32,cooldown:0,dead:false};
  const choice=selectCapableTidebreakCombo(s,{phase:'jo',comboId:'combo-1',target});
  assert.equal(choice.ok,true);assert.equal(choice.comboId,'combo-2');assert.equal(choice.techniqueId,'action.counter');assert.equal(choice.adapted,true);
  const crash=choice.attempts.find(row=>row.comboId==='combo-1'),counter=choice.attempts.find(row=>row.comboId==='combo-2');
  assert.ok(counter.situationScore>crash.situationScore);assert.ok(counter.score>crash.score);
});

test('without spatial or threat evidence the configured combo remains authoritative',()=>{
  const s=configuredState({first:'action.recover',second:'action.precision'});
  const choice=selectCapableTidebreakCombo(s,{phase:'jo',comboId:'combo-1',target:{id:'foe'}});
  assert.equal(choice.ok,true);assert.equal(choice.comboId,'combo-1');assert.equal(choice.adapted,false);
});
