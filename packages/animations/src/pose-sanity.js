import { angleQ, clamp, normalizeQ, slerp } from './quality-math.js';
// Broad screening envelopes, NOT clinical range-of-motion or final visual judgement.
export const JOINT_ENVELOPES=Object.freeze({
  shoulder:[60,100],upperArm:[170,180],elbow:[150,175],forearm:[150,180],wrist:[90,145],
  spine:[70,120],neck:[85,130],hip:[150,175],knee:[155,175],ankle:[75,120]
});
const family=n=>/Shoulder$/.test(n)?'shoulder':/UpperArm$/.test(n)?'upperArm':/LowerArm$/.test(n)?'elbow':/Hand$/.test(n)?'wrist':/UpperLeg$/.test(n)?'hip':/LowerLeg$/.test(n)?'knee':/Foot$/.test(n)?'ankle':/^(spine|chest|upperChest)$/.test(n)?'spine':/^(neck|head)$/.test(n)?'neck':null;
export function inspectPose(pose,{style='expressive',mode='warn',allowances={},correctBones=[]}={}) {
  if(!['warn','correct','off'].includes(mode)||!['expressive','natural'].includes(style))throw new Error('Invalid sanity policy');
  const rotations={},issues=[];
  for(const [bone,value] of Object.entries(pose.rotations)) {
    let q;try{q=normalizeQ(value);}catch{q=[0,0,0,1];issues.push({category:'rig',severity:'error',affectedBones:[bone],code:'non-finite-rotation'});}
    const type=family(bone),limits=JOINT_ENVELOPES[type];
    if(limits&&mode!=='off') {
      const degrees=angleQ(q,[0,0,0,1])*180/Math.PI,extra=allowances[bone]??0;
      const warning=limits[0]*(style==='natural'?.9:1)+extra,hard=Math.min(180,limits[1]+extra);
      if(degrees>warning)issues.push({category:'motion',severity:degrees>hard?'error':'warning',affectedBones:[bone],code:'joint-envelope',joint:type,degrees,limit:warning});
      // Correction is explicitly opt-in per joint; expressive actions retain their keys.
      if(mode==='correct'&&correctBones.includes(bone)&&degrees>hard)q=slerp([0,0,0,1],q,clamp(hard/degrees));
      if(type==='elbow') {
        const twist=2*Math.atan2(Math.abs(q[0]),Math.abs(q[3]))*180/Math.PI;
        if(twist>JOINT_ENVELOPES.forearm[0]+extra)issues.push({category:'motion',severity:'warning',affectedBones:[bone],code:'forearm-twist',joint:'forearm',degrees:twist});
      }
    }
    rotations[bone]=q;
  }
  return {pose:{...pose,rotations},issues};
}
export function inspectTransition(previous,current,dt,{maxRadiansPerSecond=45,maxRootSpeed=12}={}) {
  if(!previous||!(dt>0))return [];
  const issues=[];
  for(const [bone,q] of Object.entries(current.rotations))if(previous.rotations[bone]){
    const speed=angleQ(previous.rotations[bone],q)/dt;
    if(speed>maxRadiansPerSecond)issues.push({category:'transition',severity:'warning',affectedBones:[bone],code:'angular-discontinuity',speed});
  }
  if(Math.hypot(...current.hips.map((x,i)=>x-previous.hips[i]))/dt>maxRootSpeed)issues.push({category:'transition',severity:'warning',affectedBones:['hips'],code:'root-discontinuity'});
  return issues;
}
