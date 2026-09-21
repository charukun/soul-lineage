import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedTechniqueCandidates, resolveInspirationAnswer } from '@soul/game-data';
import { ensureCombatLoadout, learnedTechniqueSkills, setComboSkill, techniqueName } from '../src/combat-loadout.js';
import { answerAvailability, inspirationName } from '../src/rebuild/inspiration-state.js';
import { skillDefinition } from '../src/rebuild/skill-system.js';

const stateFor=row=>({
  seed:7,ageYears:22,stamina:100,staminaCap:100,injuries:{},equipment:{weapon:row.weapons[0]},
  knownSkills:[`basic.${row.weapons[0]}`,row.id],
  inspiration:{version:1,revision:0,clock:0,serial:0,lastNamed:-90,body:{reach:1,drive:1,balance:1,endurance:1,coordination:1},heritage:[],traces:[],seen:[],questions:{},records:{[row.id]:{answerId:row.id,archived:false}},legacySkills:[],pending:null,execution:null,sequence:[],signs:[]},
  skillWeights:{},
});

test('a generated v2 technique resolves as a real learned combat technique', () => {
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'})[0];
  const state=stateFor(row);
  assert.equal(resolveInspirationAnswer(row.id)?.id,row.id);
  assert.equal(skillDefinition(row.id)?.type,'action');
  ensureCombatLoadout(state);
  assert.ok(learnedTechniqueSkills(state).includes(row.id));
  assert.equal(inspirationName(state,row.id),row.name);
  assert.equal(techniqueName(row.id,state),row.name);
  const combo=state.combatLoadout.technique.combos[0];
  assert.equal(setComboSkill(state,combo.id,'ha',row.id),true);
  assert.equal(state.combatLoadout.technique.combos.find(item=>item.id===combo.id).slots.ha,row.id);
});

test('generated technique entry range constrains real combat availability', () => {
  const row=generatedTechniqueCandidates({weapon:'fist'}).find(item=>item.entryBands.length===1&&item.entryBands[0]==='inside');
  assert.ok(row);
  const state=stateFor(row);
  assert.equal(answerAvailability(state,row.id,{context:{distanceBand:'outside'},ignoreResources:true}).usable,false);
  assert.equal(answerAvailability(state,row.id,{context:{distanceBand:'inside'},ignoreResources:true}).usable,true);
});

test('generated technique identity survives canonical resolver reconstruction', () => {
  const row=generatedTechniqueCandidates({weapon:'dagger',phase:'kyu'})[4];
  const restored=resolveInspirationAnswer(row.id);
  assert.ok(restored);
  assert.equal(restored.name,row.name);
  assert.deepEqual(restored.steps,row.steps);
  assert.deepEqual(restored.weapons,['dagger']);
});
