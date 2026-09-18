import test from 'node:test';
import assert from 'node:assert/strict';
import {combatSequenceState} from '../src/combat-sequence.js';

test('shared combat sequence normalizes Jo-Ha-Kyu and selects the same pulse links for every app',()=>{
  assert.deepEqual(combatSequenceState('jo'),{phase:'jo',active:{jo:true,ha:false,kyu:false},link:'jo-ha'});
  assert.deepEqual(combatSequenceState('ha'),{phase:'ha',active:{jo:false,ha:true,kyu:false},link:'ha-kyu'});
  assert.deepEqual(combatSequenceState('kyu'),{phase:'kyu',active:{jo:false,ha:false,kyu:true},link:''});
  assert.deepEqual(combatSequenceState('other'),{phase:'',active:{jo:false,ha:false,kyu:false},link:''});
});
