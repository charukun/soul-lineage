import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHumanoidPose,retargetHumanoidPose,blendHumanoidPose,stabilizeMotionBoundaries,inspectPose,inspectTransition,selfIntersectionRisks,bodyCompensation,weaponCalibration,REVIEW_SWORD_CALIBRATION,qaCamera,qaSequenceAt,QA_CAMERAS,createQAReport,serializeQAReport,deserializeQAReport } from '../src/index.js';
import { segmentDistance } from '../src/quality-math.js';
const near=(a,b)=>a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<1e-6,`${a} != ${b}`));
const identity=[0,0,0,1],z90=[0,0,Math.SQRT1_2,Math.SQRT1_2];
const rest={height:2,hips:[0,1,0],bones:{leftUpperArm:{local:identity,parentWorld:identity}}};

test('normalization retargets rest axes and root height without copying limb translations',()=>{
  const pose=normalizeHumanoidPose({rotations:{leftUpperArm:z90},hips:[0,1.2,.4]},rest);
  near(pose.hips,[0,.1,.2]);
  const target={height:1,hips:[0,.5,0],bones:{leftUpperArm:{local:z90,parentWorld:identity},rightHand:{local:identity,parentWorld:identity}}};
  const out=retargetHumanoidPose(pose,target);near(out.hips,[0,.6,.2]);near(out.rotations.leftUpperArm,[0,0,1,0]);near(out.rotations.rightHand,identity);
  const rotated={...rest,bones:{leftUpperArm:{local:identity,parentWorld:z90}}};
  const x90=[Math.SQRT1_2,0,0,Math.SQRT1_2];
  near(normalizeHumanoidPose({rotations:{leftUpperArm:x90},hips:[0,1,0]},rotated).rotations.leftUpperArm,[0,Math.SQRT1_2,0,Math.SQRT1_2]);
});
test('shortest quaternion transition treats q and -q equally and fills missing previous joints',()=>{
  const a={rotations:{leftUpperArm:z90},hips:[0,0,0]},b={rotations:{leftUpperArm:z90.map(x=>-x),rightHand:identity},hips:[0,.2,0]};
  near(blendHumanoidPose(a,b,.5).rotations.leftUpperArm,z90);
  assert.deepEqual(inspectTransition(a,b,.1),[]);
  assert.ok(inspectTransition(a,{...b,rotations:{leftUpperArm:identity}},1/120).length>0);
});
test('local transition repair smooths the boundary and preserves expressive contact frames',()=>{
  const frames=Array.from({length:121},(_,i)=>({rotations:{rightHand:i<30?identity:z90},hips:[0,0,0]}));
  const repaired=stabilizeMotionBoundaries({frames,fps:60,duration:2},[[.4,.6]]);
  assert.ok(repaired[30].rotations.rightHand[3]>z90[3]);assert.equal(repaired[60],frames[60]);assert.deepEqual(frames[30].rotations.rightHand,z90);
  assert.throws(()=>normalizeHumanoidPose({rotations:{},hips:[NaN,0,0]},rest));
  assert.throws(()=>stabilizeMotionBoundaries({frames,fps:60,duration:2},[[1,3]]));
});
test('joint warning does not clamp expressive motions; explicit correction remains separate',()=>{
  const q=[Math.sin(80*Math.PI/180),0,0,Math.cos(80*Math.PI/180)];
  const p={rotations:{rightHand:q,rightLowerArm:q,leftFoot:q,neck:q,spine:q,leftShoulder:q,leftUpperLeg:q,leftLowerLeg:q},hips:[0,0,0]};
  const result=inspectPose(p);near(result.pose.rotations.rightHand,q);assert.ok(result.issues.length>=6);
  assert.ok(inspectPose(p,{mode:'correct',correctBones:['rightHand']}).pose.rotations.rightHand[3]>q[3]);
  near(inspectPose(p,{allowances:{rightHand:90}}).pose.rotations.rightHand,q);
  assert.ok(inspectPose({rotations:{spine:[NaN,0,0,1]},hips:[0,0,0]}).issues.some(i=>i.code==='non-finite-rotation'));
});
test('capsules detect crossing/degenerate segments and retain unmeasured visual categories',()=>{
  assert.equal(segmentDistance([-1,0,0],[1,0,0],[0,-1,0],[0,1,0]),0);
  assert.equal(segmentDistance([0,0,0],[0,0,0],[1,0,0],[2,0,0]),1);
  const points={hips:[0,0,0],chest:[0,1,0],leftUpperArm:[.3,1,0],leftLowerArm:[0,.5,0],leftHand:[0,.3,0]};
  const r=selfIntersectionRisks({points,torsoRadius:.15,armRadius:.04});assert.ok(r.issues.some(i=>i.code==='forearm-torso'));assert.ok(r.visualRequired.includes('hair'));
});
test('weapon/body calibration accepts anatomical variation and rejects malformed profiles',()=>{
  assert.equal(bodyCompensation({arms:.9,shoulders:1.1,ageScale:.5}).reachRatio,.9/1.1);
  assert.equal(bodyCompensation().layer,'presentation');assert.throws(()=>bodyCompensation({width:Infinity}));
  const two=weaponCalibration({...REVIEW_SWORD_CALIBRATION,twoHanded:true,supportGrip:[0,-.25,0]});assert.equal(two.twoHanded,true);
  assert.throws(()=>weaponCalibration({...two,scale:-1}));assert.throws(()=>weaponCalibration({...two,grip:[0,NaN,0]}));
});
test('eight deterministic cameras and source sequence are independent of pose/random time',()=>{
  const positions=new Set();for(const id of Object.keys(QA_CAMERAS)){const a=qaCamera(id,{aspect:390/420});assert.deepEqual(a,qaCamera(id,{aspect:390/420}));positions.add(a.position.join(','));}
  assert.equal(positions.size,8);assert.equal(qaCamera('front').position[0],0);assert.ok(qaCamera('left').position[0]>0);
  assert.equal(qaSequenceAt(11).id,'draw');assert.equal(qaSequenceAt(17).source,'authored-slash');assert.equal(qaSequenceAt(30).frame,1800);
  assert.throws(()=>qaCamera('random'));assert.throws(()=>qaSequenceAt(NaN));
});
test('QA JSON round trips human/worker evidence and rejects invalid/unbounded imports',()=>{
  const report=createQAReport({review:{sequence:'test',fps:60,viewport:[390,420],dpr:1,lighting:'fixed',motionRevision:'source1',characters:[]}});
  report.issues.push({id:'one',character:'Shino',motion:'slash',timestamp:.5,frame:30,camera:'front-left',affectedBones:['rightUpperArm'],severity:'warning',category:'self intersection',note:'arm crosses torso',before:null,after:null,status:'open'});
  assert.deepEqual(deserializeQAReport(serializeQAReport(report)),report);assert.equal(report.visualApproval,'pending');
  for(const patch of [{category:'made-up'},{severity:'approved'},{timestamp:NaN},{affectedBones:'wrist'}]){const bad=structuredClone(report);Object.assign(bad.issues[0],patch);assert.throws(()=>serializeQAReport(bad));}
  assert.throws(()=>deserializeQAReport('{broken'));assert.throws(()=>deserializeQAReport('x'.repeat(1_000_001)));
});
