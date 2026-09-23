import test from 'node:test';
import assert from 'node:assert/strict';
import {createObservedCombatLocomotion} from '../src/web/observed-combat-locomotion.js';

test('observed locomotion advances from authoritative displacement and survives full combat stance',()=>{
  const gait=createObservedCombatLocomotion(),p={x:0,z:0,yaw:0,walk:999};
  const idle=gait.sample(p,1/60,{combatWeight:1});
  assert.equal(idle.moving,false);assert.equal(idle.stance,1);
  p.z=.08;const first=gait.sample(p,1/60,{combatWeight:1});
  assert.equal(first.moving,true);assert.ok(first.speed>0);assert.ok(Math.abs(first.swing)>0);
  const phase=first.phase;
  p.z=.16;p.walk=-999;const second=gait.sample(p,1/60,{combatWeight:1});
  assert.ok(second.phase>phase,'phase follows displacement rather than the legacy walk counter');
  assert.ok(second.stance>0&&second.motionStrength>0,'combat movement keeps a guarded lower-body gait');
});

test('observed locomotion treats teleports as resets instead of giant strides',()=>{
  const gait=createObservedCombatLocomotion(),p={x:1,z:1,yaw:0};
  gait.sample(p,1/60);p.z=1.1;gait.sample(p,1/60);
  p.z=10;const teleported=gait.sample(p,1/60,{combatWeight:0});
  assert.equal(teleported.moving,false);assert.equal(teleported.speed,0);assert.equal(teleported.phase,0);
});
