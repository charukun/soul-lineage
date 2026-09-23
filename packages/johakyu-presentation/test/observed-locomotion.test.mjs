import test from 'node:test';
import assert from 'node:assert/strict';
import {applyObservedCombatLocomotionPose,combatStanceWeight,createObservedCombatLocomotion} from '../src/observed-locomotion.js';

const bone=()=>({rotation:{x:0,y:0,z:0},position:{x:0,y:0,z:0}});
const rig=()=>Object.fromEntries(['hips','spine','head','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm'].map(name=>[name,bone()]));

test('shared observed locomotion follows displacement and keeps a ready stance while moving',()=>{
  const locomotion=createObservedCombatLocomotion(),p={x:0,z:0,yaw:0,walk:999};
  assert.equal(locomotion.sample(p,1/60,{combatWeight:1}).moving,false);
  p.z=.08;const first=locomotion.sample(p,1/60,{combatWeight:1});assert.equal(first.moving,true);assert.ok(first.speed>0);assert.ok(Math.abs(first.swing)>0);assert.ok(first.stance>0);
  const phase=first.phase;p.z=.16;p.walk=-999;const second=locomotion.sample(p,1/60,{combatWeight:1});assert.ok(second.phase>phase);
  const bones=rig();applyObservedCombatLocomotionPose(bones,second,{guardArms:true,breath:.5});assert.notEqual(bones.leftUpperLeg.rotation.x,0);assert.ok(bones.hips.position.y<.02);assert.notEqual(bones.rightUpperArm.rotation.z,0);
});

test('shared stance opens through the strike and returns during recovery',()=>{
  assert.equal(combatStanceWeight({active:true,attack:false}),1);
  assert.ok(combatStanceWeight({active:true,attack:true,progress:.06})<1);
  assert.equal(combatStanceWeight({active:true,attack:true,progress:.5}),0);
  assert.ok(combatStanceWeight({active:true,attack:true,progress:.91})>0);
  assert.equal(combatStanceWeight({active:false,attack:false}),0);
});

test('teleports reset gait instead of becoming giant strides',()=>{
  const locomotion=createObservedCombatLocomotion(),p={x:1,z:1,yaw:0};locomotion.sample(p,1/60);p.z=1.1;locomotion.sample(p,1/60);p.z=10;
  const frame=locomotion.sample(p,1/60,{combatWeight:1});assert.equal(frame.moving,false);assert.equal(frame.speed,0);assert.equal(frame.phase,0);
});
