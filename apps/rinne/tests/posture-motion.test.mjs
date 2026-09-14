import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/simulator/vendor/three.js';
import {loadRuntime} from '../scripts/sword-capture-runtime.mjs';
import {MASTER_STANCES} from '../public/simulator/src/posture-motion.js';
import {applyPostureReview} from '../public/simulator/src/posture-sequence.js';
import {rawClipFromNormalized,sampleRawClip} from '../src/review/pose-transfer.js';
const v=()=>new T.Vector3();
const reset=c=>{c.state=null;c.lastActual=null;c.blending=null;c.footLocks={};};
function bend(c,side){const a=c.bones[side+'UpperArm'].getWorldPosition(v()).sub(c.bones[side+'LowerArm'].getWorldPosition(v())),b=c.bones[side+'Hand'].getWorldPosition(v()).sub(c.bones[side+'LowerArm'].getWorldPosition(v()));return 180-T.MathUtils.radToDeg(a.angleTo(b));}

test('all shared stances loop with grounded feet and relaxed, bent arms',async()=>{
 const runtime=await loadRuntime(),c=runtime.current;let maxFloorError=0,maxLoopAngle=0;
 try{
  for(const id of ['normal',...MASTER_STANCES.map(row=>row.id)]){
   const clip=runtime.bakeStanding(c,id);runtime.resetRoot(c);runtime.resetBones(c);sampleRawClip(clip,c.root,0);
   const start=Object.fromEntries(Object.entries(c.bones).map(([n,b])=>[n,b.quaternion.clone()]));
   for(const t of [0,.3,1,1.9,3,4]){sampleRawClip(clip,c.root,t);
    for(const side of ['left','right'])maxFloorError=Math.max(maxFloorError,Math.abs(runtime.point(c,side+'Foot').y-c.neutralPoints[side+'Foot'].y));
    if(id==='normal')for(const side of ['left','right'])assert.ok(bend(c,side)>10&&bend(c,side)<45,`normal ${side} elbow ${bend(c,side)}`);
    if(id==='balanced')for(const side of ['left','right'])assert.ok(bend(c,side)>35&&bend(c,side)<130,`guard ${side} elbow ${bend(c,side)}`);
   }
   for(const [n,b]of Object.entries(c.bones))maxLoopAngle=Math.max(maxLoopAngle,b.quaternion.angleTo(start[n]));
  }
  assert.ok(maxFloorError<.005,`stance foot floats ${maxFloorError}`);assert.ok(maxLoopAngle<.00001,`stance loop pop ${maxLoopAngle}`);
  console.log({stances:MASTER_STANCES.length+1,maxFloorError,maxLoopAngle});
 }finally{runtime.dispose(c);}
});

test('gait threshold and movement start/stop do not snap the full body',async()=>{
 const runtime=await loadRuntime(),c=runtime.current;
 const actor={id:'gait-quality',hero:true,lifeAgeYears:22,weapon:'sword',weaponDraw:1,combatReady:true,x:0,z:0,yaw:0,vx:0,vz:0,_humanoidClock:1,_humanoidPhase:.37};
 const joints=['hips','head','leftHand','rightHand','leftFoot','rightFoot'];let maxThreshold=0,maxStopFootStep=0,previous=null;
 try{
  const poses=[];for(const speed of [2.3999,2.4001]){reset(c);actor.vz=speed;runtime.render(actor);poses.push(Object.fromEntries(joints.map(n=>[n,c.raw[n].getWorldPosition(v())])));}
  for(const n of joints)maxThreshold=Math.max(maxThreshold,poses[0][n].distanceTo(poses[1][n]));
  assert.ok(maxThreshold<.002,`walk/run boundary jumps ${maxThreshold} m`);
  reset(c);
  for(let i=0;i<=18*60;i++){const t=i/60;applyPostureReview(actor,t,c.locomotion);const result=runtime.render(actor);assert.ok(c.finite);assert.ok(c.socketError<1e-5);
   const feet=['leftFoot','rightFoot'].map(n=>c.raw[n].getWorldPosition(v()));
   if(previous&&t>=10.3&&t<=11.1)maxStopFootStep=Math.max(maxStopFootStep,...feet.map((p,j)=>p.distanceTo(previous[j])));
   previous=feet;assert.ok(result.weaponTip.every(Number.isFinite));
  }
  assert.ok(maxStopFootStep<.045,`foot snaps into stopped guard ${maxStopFootStep} m/frame`);
  console.log({maxThreshold,maxStopFootStep60Hz:maxStopFootStep});
 }finally{runtime.dispose(c);}
});

test('Lab posture and gait bakes reproduce the normalized runtime on the visible raw rig',async()=>{
 const runtime=await loadRuntime(),c=runtime.current;let maxAngle=0,maxPosition=0;
 try{
  for(const [type,id]of [['stance','normal'],['stance','balanced'],['stance','defensive'],['gait','walk'],['gait','run']]){
   const clip=type==='gait'?runtime.bakeLocomotion(c,id):runtime.bakeStanding(c,id),raw=rawClipFromNormalized(clip,c.bones,c.vrm,c.raw);
   for(const p of [0,.13,.47,.95,1,.28,0]){
    runtime.resetRoot(c);runtime.resetBones(c);sampleRawClip(clip,c.root,p*clip.duration);c.vrm.humanoid.update();
    const expected=Object.fromEntries(Object.entries(c.raw).map(([n,b])=>[n,{q:b.quaternion.clone(),p:b.position.clone()}]));
    for(const b of Object.values(c.raw))b.quaternion.identity();sampleRawClip(raw,c.root,p*clip.duration);
    for(const [n,b]of Object.entries(c.raw)){maxAngle=Math.max(maxAngle,b.quaternion.clone().normalize().angleTo(expected[n].q.normalize()));maxPosition=Math.max(maxPosition,b.position.distanceTo(expected[n].p));}
   }
  }
  assert.ok(maxAngle<.00005);assert.ok(maxPosition<.00001);console.log({labMaxAngle:maxAngle,labMaxPosition:maxPosition});
 }finally{runtime.dispose(c);}
});
