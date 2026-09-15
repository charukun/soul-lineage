import { inverseQ, multiplyQ, normalizeQ, slerp, mix, clamp } from './quality-math.js';
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
function checkPose(pose){if(!pose||!vector(pose.hips)||!pose.rotations||Array.isArray(pose.rotations)||Object.keys(pose.rotations).length>256)throw new Error('Invalid humanoid pose');}
function checkRest(rest){if(!rest||!Number.isFinite(rest.height)||rest.height<=.1||rest.height>100||!vector(rest.hips)||!rest.bones)throw new Error('Invalid humanoid rest');}

/** Rotation deltas in the humanoid rest WORLD frame, independent of raw bone axes.
 * Rig adapters capture rest once, never infer it from a currently animated pose.
 * Bone translations/lengths stay target-owned. Only pelvis displacement scales.
 */
export function normalizeHumanoidPose(pose, rest) {
  checkPose(pose);checkRest(rest);
  const rotations={};
  for(const [name,q] of Object.entries(pose.rotations)) {
    const r=rest.bones[name]; if(!r)continue;
    rotations[name]=normalizeQ(multiplyQ(multiplyQ(r.parentWorld,multiplyQ(normalizeQ(q),inverseQ(r.local))),inverseQ(r.parentWorld)));
  }
  return {rotations,hips:pose.hips.map((x,i)=>(x-rest.hips[i])/rest.height)};
}
export function retargetHumanoidPose(pose, rest) {
  checkPose(pose);checkRest(rest);
  const rotations={};
  for(const [name,r] of Object.entries(rest.bones)) {
    const q=pose.rotations[name]??[0,0,0,1];
    rotations[name]=normalizeQ(multiplyQ(multiplyQ(multiplyQ(inverseQ(r.parentWorld),q),r.parentWorld),r.local));
  }
  return {rotations,hips:pose.hips.map((x,i)=>rest.hips[i]+x*rest.height)};
}
export function blendHumanoidPose(a,b,t) {
  checkPose(a);checkPose(b);if(!Number.isFinite(t))throw new Error('Invalid blend time');
  const rotations={};
  for(const n of new Set([...Object.keys(a.rotations),...Object.keys(b.rotations)]))rotations[n]=slerp(a.rotations[n]??[0,0,0,1],b.rotations[n]??[0,0,0,1],t);
  return {rotations,hips:mix(a.hips,b.hips,clamp(t))};
}
export function sampleMotionFrames(bank,seconds) {
  if(!Number.isFinite(seconds))throw new Error('Invalid motion time');
  const f=clamp(seconds,0,bank.duration)*bank.fps,i=Math.min(Math.floor(f),bank.frames.length-1);
  return blendHumanoidPose(bank.frames[i],bank.frames[Math.min(i+1,bank.frames.length-1)],f-i);
}

/** Deterministic local transition repair. Callers supply explicit transition ranges;
 * never run a global low-pass filter over a fast skill's contact/release keys. */
export function stabilizeMotionBoundaries(bank,ranges) {
  const frames=bank.frames.slice();
  for(const [from,to]of ranges){
    if(!Number.isFinite(from+to)||from<0||to<=from||to>bank.duration)throw new Error('Invalid transition range');
    const a=Math.round(from*bank.fps),b=Math.round(to*bank.fps),start=bank.frames[a],end=bank.frames[b];
    for(let i=a+1;i<b;i++){const t=(i-a)/(b-a),ease=t*t*(3-2*t);frames[i]=blendHumanoidPose(start,end,ease);}
  }
  return frames;
}
