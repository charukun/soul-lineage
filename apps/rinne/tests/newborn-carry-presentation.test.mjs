import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEWBORN_CARRY,
  applyCarrierCradlePose,
  applyNewbornCradlePose,
  hideCarrierCombatProps,
  isCarrierCombatPropName,
  newbornCarryTransform
} from '../src/rebuild/newborn-carry-presentation.js';

const bone=()=>({rotation:{x:0,y:0,z:0}});

test('newborn cradle stays high, close, and angled into the carrier torso',()=>{
  const facingNorth=newbornCarryTransform({x:10,z:20},0);
  assert.equal(facingNorth.x,10+NEWBORN_CARRY.side);
  assert.equal(facingNorth.z,20+NEWBORN_CARRY.forward);
  assert.equal(facingNorth.y,NEWBORN_CARRY.height);
  assert.equal(facingNorth.pitch,NEWBORN_CARRY.pitch);
  assert.equal(facingNorth.roll,NEWBORN_CARRY.roll);
  assert.equal(facingNorth.yaw,NEWBORN_CARRY.yawOffset);
  assert.ok(NEWBORN_CARRY.forward<.35,'child should stay against the carrier torso');
  assert.ok(NEWBORN_CARRY.height>1,'child should read at chest/upper-waist height');

  const facingEast=newbornCarryTransform({x:10,z:20},Math.PI/2);
  assert.ok(Math.abs(facingEast.x-(10+NEWBORN_CARRY.forward))<1e-9);
  assert.ok(Math.abs(facingEast.z-(20-NEWBORN_CARRY.side))<1e-9);
});

test('carrier cradle pose is asymmetric and supports both shoulder and hip sides',()=>{
  const bones={
    spine:bone(),chest:bone(),neck:bone(),head:bone(),
    leftUpperArm:bone(),leftLowerArm:bone(),leftHand:bone(),
    rightUpperArm:bone(),rightLowerArm:bone(),rightHand:bone()
  };
  applyCarrierCradlePose(bones,0,{moving:false});
  assert.ok(bones.leftUpperArm.rotation.z<-.4);
  assert.ok(bones.rightUpperArm.rotation.z>.3);
  assert.ok(bones.leftLowerArm.rotation.y<-.25);
  assert.ok(bones.rightLowerArm.rotation.y>.3);
  assert.notEqual(bones.leftLowerArm.rotation.x,bones.rightLowerArm.rotation.x);
  assert.ok(bones.head.rotation.x>0,'carrier should look slightly down toward the child');
});

test('newborn cradle pose visibly curls hips, knees, and arms',()=>{
  const bones={
    spine:bone(),chest:bone(),neck:bone(),head:bone(),
    leftUpperLeg:bone(),rightUpperLeg:bone(),leftLowerLeg:bone(),rightLowerLeg:bone(),
    leftUpperArm:bone(),rightUpperArm:bone(),leftLowerArm:bone(),rightLowerArm:bone()
  };
  applyNewbornCradlePose(bones,0);
  assert.ok(bones.leftUpperLeg.rotation.x>.6);
  assert.ok(bones.rightUpperLeg.rotation.x>.5);
  assert.ok(bones.leftLowerLeg.rotation.x<-.8);
  assert.ok(bones.rightLowerLeg.rotation.x<-.8);
  assert.ok(bones.leftLowerArm.rotation.x<-.6);
  assert.ok(bones.rightLowerArm.rotation.x<-.6);
});

test('carrier combat props are recognized without classifying body bones as props',()=>{
  assert.equal(isCarrierCombatPropName('Crossbow'),true);
  assert.equal(isCarrierCombatPropName('Weapon_Shield'),true);
  assert.equal(isCarrierCombatPropName('Rig_Medium_LeftHand'),false);
});

test('carrier combat prop hiding leaves bones and ordinary meshes alone',()=>{
  const nodes=[
    {name:'Crossbow',visible:true,isBone:false},
    {name:'WeaponSocket',visible:true,isBone:true},
    {name:'Body',visible:true,isBone:false}
  ];
  const root={traverse(callback){nodes.forEach(callback);}};
  assert.equal(hideCarrierCombatProps(root),1);
  assert.equal(nodes[0].visible,false);
  assert.equal(nodes[1].visible,true);
  assert.equal(nodes[2].visible,true);
});
