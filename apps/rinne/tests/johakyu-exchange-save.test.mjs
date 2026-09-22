import test from 'node:test';
import assert from 'node:assert/strict';
import {clearSavedPresentation} from '../src/rebuild/johakyu-save-contract.js';
test('save keeps permanent physiology and causality but drops Exchange and HUD projection',()=>{
  const state={hp:83,stamina:42,injuries:{rightArm:{severity:.3}},equipment:{weapon:'sword'},inspiration:{learned:['answer'],records:[{techniqueId:'answer'}],execution:{attackId:'flight'}},combat:{phase:'kyu',exchange:{mode:'reversal',initiativeId:'hero',transition:'counter'},hudState:'kyu',tidebreakPose:{attackId:'flight'}},frontState:{enemies:[{hp:70,injuries:{},tidebreakPose:{attack:'slash'}}]}};
  const before=structuredClone(state);clearSavedPresentation(state);
  assert.equal(state.combat.exchange,undefined);assert.equal(state.combat.hudState,undefined);assert.equal(state.combat.tidebreakPose,undefined);assert.equal(state.inspiration.execution,undefined);assert.equal(state.frontState.enemies[0].tidebreakPose,null);
  for(const key of ['hp','stamina','injuries','equipment'])assert.deepEqual(state[key],before[key]);
  assert.deepEqual(state.inspiration.learned,before.inspiration.learned);assert.deepEqual(state.inspiration.records,before.inspiration.records);
});
