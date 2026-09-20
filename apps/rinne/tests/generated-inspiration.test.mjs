import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedTechniqueCandidates, resolveInspirationAnswer } from '@soul/game-data';
import { ensureCombatLoadout, learnedTechniqueSkills, setComboSkill, techniqueName } from '../src/combat-loadout.js';
import { inspirationName } from '../src/rebuild/inspiration-state.js';
import { skillDefinition } from '../src/rebuild/skill-system.js';

test('a generated technique resolves as a real learned combat technique', () => {
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'})[0];
  assert.ok(row);
  assert.equal(resolveInspirationAnswer(row.id)?.id,row.id);
  assert.equal(skillDefinition(row.id)?.type,'action');
  const state={
    equipment:{weapon:'spear'},
    knownSkills:['basic.spear',row.id],
    inspiration:{version:1,legacySkills:[],records:{[row.id]:{answerId:row.id,archived:false}}},
    skillWeights:{},
  };
  ensureCombatLoadout(state);
  assert.ok(learnedTechniqueSkills(state).includes(row.id));
  assert.equal(inspirationName(state,row.id),row.name);
  assert.equal(techniqueName(row.id,state),row.name);
  const combo=state.combatLoadout.technique.combos[0];
  assert.equal(setComboSkill(state,combo.id,'ha',row.id),true);
  assert.equal(combo.slots.ha,row.id);
});

test('generated technique identity survives canonical resolver reconstruction', () => {
  const row=generatedTechniqueCandidates({weapon:'dagger',phase:'kyu'})[4];
  const restored=resolveInspirationAnswer(row.id);
  assert.ok(restored);
  assert.equal(restored.name,row.name);
  assert.deepEqual(restored.steps,row.steps);
  assert.deepEqual(restored.weapons,['dagger']);
});
