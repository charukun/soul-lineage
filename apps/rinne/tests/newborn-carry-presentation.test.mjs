import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Vector3} from 'three';
import {
  NEWBORN_CARRY,
  applyCarrierCradlePose,
  applyNewbornCradlePose,
  hideCarrierCombatProps,
  isCarrierCombatPropName,
  newbornCarryTransform,
  positionNewbornForCradle,
  solveCarrierCradleContacts,
  sanitizeCarrierCarryVisual
} from '../src/rebuild/newborn-carry-presentation.js';

const bone=()=>({rotation:{x:0,y:0,z:0}});

test('newborn carry no longer rolls the actor around its feet origin',()=>{
  const carry=newbornCarryTransform({x:10,z:20},0);
  assert.equal(carry.roll,0);
  assert.equal(carry.pitch,0);
  assert.equal(carry.scale,NEWBORN_CARRY.visualScale);
  assert.ok(NEWBORN_CARRY.visualScale<.8,'newborn presentation must be smaller than the lifecycle floor model');
  assert.ok(NEWBORN_CARRY.pelvisForward<.2,'pelvis should sit tight against the carrier torso');
});

test('carrier cradle pose is asymmetric before contact IK',()=>{
  const bones={
    spine:bone(),chest:bone(),neck:bone(),head:bone(),
    leftUpperArm:bone(),leftLowerArm:bone(),leftHand:bone(),
    rightUpperArm:bone(),rightLowerArm:bone(),rightHand:bone()
  };
  applyCarrierCradlePose(bones,0,{moving:false});
  assert.ok(bones.leftUpperArm.rotation.z<-.45);
  assert.ok(bones.rightUpperArm.rotation.z>.35);
  assert.ok(bones.leftLowerArm.rotation.y<-.3);
  assert.ok(bones.rightLowerArm.rotation.y>.4);
  assert.ok(bones.head.rotation.x>0);
});

test('newborn cradle rotates around hips and curls all four limbs',()=>{
  const bones={
    hips:bone(),spine:bone(),chest:bone(),neck:bone(),head:bone(),
    leftUpperLeg:bone(),rightUpperLeg:bone(),leftLowerLeg:bone(),rightLowerLeg:bone(),
    leftUpperArm:bone(),rightUpperArm:bone(),leftLowerArm:bone(),rightLowerArm:bone()
  };
  applyNewbornCradlePose(bones,0);
  assert.ok(bones.hips.rotation.z<-1,'body recline must pivot at pelvis, not actor root');
  assert.ok(bones.leftUpperLeg.rotation.x>.8);
  assert.ok(bones.rightUpperLeg.rotation.x>.7);
  assert.ok(bones.leftLowerLeg.rotation.x<-1);
  assert.ok(bones.rightLowerLeg.rotation.x<-1);
  assert.ok(bones.leftLowerArm.rotation.x<-.7);
  assert.ok(bones.rightLowerArm.rotation.x<-.7);
});

function chain(prefix,x=0){
  const upper=new Bone(),lower=new Bone(),hand=new Bone();
  upper.name=prefix+'Upper';lower.name=prefix+'Lower';hand.name=prefix+'Hand';
  upper.position.set(x,0,0);lower.position.set(.35,0,0);hand.position.set(.3,0,0);
  upper.add(lower);lower.add(hand);
  return{upper,lower,hand};
}

test('carrier contact solver moves both hands toward child support points',()=>{
  const root=new Group(),left=chain('left',-.2),right=chain('right',.2);
  root.add(left.upper,right.upper);
  const childRoot=new Group(),hips=new Bone(),spine=new Bone(),head=new Bone(),leftUpperLeg=new Bone(),rightUpperLeg=new Bone();
  hips.position.set(.35,.12,.1);spine.position.set(0,.18,0);head.position.set(0,.22,0);leftUpperLeg.position.set(-.08,-.12,0);rightUpperLeg.position.set(.08,-.12,0);
  hips.add(spine,leftUpperLeg,rightUpperLeg);spine.add(head);childRoot.add(hips);root.add(childRoot);root.updateMatrixWorld(true);
  const childBones={hips,spine,head,leftUpperLeg,rightUpperLeg};
  const beforeLeft=left.hand.getWorldPosition(new Vector3()).distanceTo(spine.getWorldPosition(new Vector3()));
  const beforeRight=right.hand.getWorldPosition(new Vector3()).distanceTo(hips.getWorldPosition(new Vector3()));
  const result=solveCarrierCradleContacts({
    leftUpperArm:left.upper,leftLowerArm:left.lower,leftHand:left.hand,
    rightUpperArm:right.upper,rightLowerArm:right.lower,rightHand:right.hand
  },childBones);
  root.updateMatrixWorld(true);
  const afterLeft=left.hand.getWorldPosition(new Vector3()).distanceTo(spine.getWorldPosition(new Vector3()));
  const afterRight=right.hand.getWorldPosition(new Vector3()).distanceTo(hips.getWorldPosition(new Vector3()));
  assert.equal(result.solved,true);
  assert.ok(afterLeft<beforeLeft);
  assert.ok(afterRight<beforeRight);
});

test('newborn pelvis anchor follows carrier torso instead of a free-floating world offset',()=>{
  const scene=new Group(),carrierRoot=new Group(),spine=new Bone(),childRoot=new Group(),hips=new Bone();
  carrierRoot.add(spine);scene.add(carrierRoot,childRoot);spine.position.set(0,1.1,0);carrierRoot.position.set(2,0,3);childRoot.add(hips);hips.position.set(0,.4,0);scene.updateMatrixWorld(true);
  const target=positionNewbornForCradle({carrierRoot,carrierBones:{spine},childRoot,childBones:{hips},time:0,moving:false});
  scene.updateMatrixWorld(true);
  const actual=hips.getWorldPosition(new Vector3());
  assert.ok(actual.distanceTo(new Vector3(target.x,target.y,target.z))<1e-6);
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


test('carry visual sanitizer removes non-combat held props and suppresses attachments',()=>{
  const nodes=[
    {name:'Orb_RightHand',visible:true,isBone:false},
    {name:'PotionBottle',visible:true,isBone:false},
    {name:'Rig_Medium_RightHand',visible:true,isBone:true},
    {name:'Body',visible:true,isBone:false}
  ];
  const root={userData:{},traverse(callback){nodes.forEach(callback);}},attachments={visible:true};
  const hidden=sanitizeCarrierCarryVisual(root,{attachments,active:true});
  assert.equal(hidden,2);
  assert.equal(attachments.visible,false);
  assert.equal(nodes[0].visible,false);
  assert.equal(nodes[1].visible,false);
  assert.equal(nodes[2].visible,true);
  assert.equal(nodes[3].visible,true);
  assert.equal(root.userData.carryPropSanitized,true);
});

test('carry visual sanitizer restores attachment visibility outside carry without hiding body',()=>{
  const nodes=[{name:'Body',visible:true,isBone:false}];
  const root={userData:{},traverse(callback){nodes.forEach(callback);}},attachments={visible:false};
  assert.equal(sanitizeCarrierCarryVisual(root,{attachments,active:false}),0);
  assert.equal(attachments.visible,true);
  assert.equal(nodes[0].visible,true);
});
