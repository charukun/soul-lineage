import test from 'node:test';
import assert from 'node:assert/strict';
import {COMBAT_LOCOMOTION,combatReachPolicy,combatReadyEnvelope} from '../src/locomotion.js';

test('Bloodline locomotion speed is the shared canonical movement speed',()=>{
  assert.equal(COMBAT_LOCOMOTION.walkSpeed,3.8);
  assert.equal(COMBAT_LOCOMOTION.dashSpeed,3.8*1.72);
});

test('engagement and combat-ready range use one shared reach policy',()=>{
  const sword=combatReachPolicy({weapon:'sword'});assert.equal(sword.weaponReach,1.45);assert.equal(sword.engagementRange,2.1);assert.equal(sword.readyExitRange,2.65);
  const katana=combatReachPolicy({weapon:'katana'});assert.deepEqual(katana,sword);
  assert.equal(COMBAT_LOCOMOTION.gaitPhasePerMeter,3.8);
});

test('combat-ready range enters at weapon reach and exits with hysteresis',()=>{
  const outside=combatReadyEnvelope({distance:2.18,weapon:'sword'});assert.equal(outside.enterRange,2.1);assert.equal(outside.exitRange,2.65);assert.equal(outside.ready,false);
  assert.equal(combatReadyEnvelope({distance:2.05,weapon:'sword'}).ready,true);
  assert.equal(combatReadyEnvelope({distance:2.55,weapon:'sword',wasReady:true}).ready,true);
  assert.equal(combatReadyEnvelope({distance:2.7,weapon:'sword',wasReady:true}).ready,false);
});
