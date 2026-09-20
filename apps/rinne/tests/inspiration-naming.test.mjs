import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAUSAL_ANSWERS,
  CAUSAL_ANSWER_BY_ID,
  inspirationTechniqueGrade,
  inspirationTechniqueName,
  inspirationTechniquePresentation,
  inspirationTechniqueStructureKey,
  validateCausalAnswers,
  validateInspirationNamePolicy,
} from '@soul/game-data';
import { inspirationName } from '../src/rebuild/inspiration-state.js';

test('inspiration names are canonical and ignore player-authored save names', () => {
  const state={inspiration:{records:{'spark.spear.tide':{name:'俺の最強技'}}}};
  assert.equal(inspirationName(state,'spark.spear.tide'),'潮返し');
});

test('same technique structure keeps the same base name regardless of attributes or traits', () => {
  const base={id:'a',kind:'technique',name:'潮返し',weapons:['spear'],steps:[{kind:'thrust',footwork:'chase',charge:'none'}],attributes:[],specialEffects:[]};
  const fire={...base,id:'b',attributes:['fire'],specialEffects:[{id:'burn',label:'燃焼',impact:'status',rarity:'common'}]};
  assert.equal(inspirationTechniqueStructureKey(base),inspirationTechniqueStructureKey(fire));
  assert.equal(inspirationTechniqueName(base),'潮返し');
  assert.equal(inspirationTechniqueName(fire),'潮返し');
  assert.equal(inspirationTechniqueGrade(fire),'normal');
  assert.deepEqual(inspirationTechniquePresentation(fire).attributes,['炎']);
  assert.deepEqual(inspirationTechniquePresentation(fire).traits,['燃焼']);
  assert.equal(validateInspirationNamePolicy([base,fire]),true);
});

test('attribute labels cannot leak into a technique base name', () => {
  const row={id:'bad',kind:'technique',name:'炎潮返し',weapons:['spear'],steps:[{kind:'thrust',footwork:'chase',charge:'none'}],attributes:['fire'],specialEffects:[]};
  assert.throws(()=>validateInspirationNamePolicy([row]),/Attribute leaked/);
});

test('same structural technique cannot receive multiple authored names', () => {
  const a={id:'a',kind:'technique',name:'潮返し',weapons:['spear'],steps:[{kind:'thrust',footwork:'chase',charge:'none'}],attributes:[],specialEffects:[]};
  const b={...a,id:'b',name:'波返し',attributes:['water']};
  assert.throws(()=>validateInspirationNamePolicy([a,b]),/multiple names/);
});

test('secret and ultimate grades derive from rule-changing traits instead of manual labels', () => {
  const base={name:'潮返し',kind:'technique',weapons:['spear'],steps:[{kind:'thrust',footwork:'chase',charge:'none'}],attributes:[]};
  const status={...base,specialEffects:[{id:'burn',label:'燃焼',impact:'status',rarity:'rare'}]};
  const secret={...base,specialEffects:[{id:'wake',label:'残火領域',impact:'rule',rarity:'rare'}]};
  const ultimate={...base,specialEffects:[{id:'break-law',label:'防御則破り',impact:'rule',rarity:'singular',unlockCondition:'特定の系譜条件'}]};
  assert.equal(inspirationTechniqueName(status),'潮返し');
  assert.equal(inspirationTechniqueName(secret),'秘技・潮返し');
  assert.equal(inspirationTechniqueName(ultimate),'奥義・潮返し');
  assert.equal(inspirationTechniqueGrade(status),'normal');
  assert.equal(inspirationTechniqueGrade(secret),'secret');
  assert.equal(inspirationTechniqueGrade(ultimate),'ultimate');
});

test('authored catalog obeys compact base-name and structural naming policy', () => {
  assert.equal(validateCausalAnswers(),true);
  for(const row of CAUSAL_ANSWERS){
    const rendered=inspirationTechniqueName(row);
    assert.ok((rendered.match(/・/g)||[]).length<=1,rendered);
  }
  assert.equal(CAUSAL_ANSWER_BY_ID['spark.spear.wedge'].name,'楔返し');
  assert.equal(CAUSAL_ANSWER_BY_ID['spark.great.wait'].name,'待受落とし');
});
