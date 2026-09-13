/** Companion cuts for Shino. Same canonical rig/IK as the approved slash. */
import {poseCurve,sampleSlashPose,slashTime,applySwordPose} from './authored-slash.js';
export const AUTHORED_SWORD_KINDS=Object.freeze(['back','uppercut','thrust','heavy']);
const guard=sampleSlashPose(0);
const curve=(name,rows,p)=>poseCurve([[0,...guard[name]],...rows,[1,...guard[name]]],p);
export function sampleSwordPose(kind,phase,contact=.5){
 const p=slashTime(phase,contact),pose=sampleSlashPose(p);
 if(kind==='back'){
  for(const n of ['hips','spine','chest','head'])pose[n][1]*=-.85;
  pose.offset[0]*=-.5;
  pose.grip=curve('grip',[[.27,.30,-.48,.16],[.38,.34,-.44,.21],[.50,.015,-.25,.49],[.64,-.36,-.14,.29],[.80,-.32,-.16,.17]],p);
  pose.blade=curve('blade',[[.27,1.85,-.35,.40],[.38,1.75,-.25,.40],[.50,0,.16,0],[.64,-1.65,.65,-.32],[.80,-1.35,.83,-.22]],p);
 }else if(kind==='uppercut'){
  pose.hips[1]*=.65;pose.spine[0]*=.75;pose.offset[1]-=.025*Math.sin(Math.PI*p);
  pose.grip=curve('grip',[[.27,-.31,-.57,.15],[.38,-.32,-.55,.23],[.50,-.07,-.27,.51],[.64,.12,.09,.30],[.80,.02,-.02,.22]],p);
  pose.blade=curve('blade',[[.27,-.7,-1.10,-.18],[.38,-.5,-.90,-.20],[.50,0,.12,0],[.64,.55,1.2,.10],[.80,.4,1.25,.08]],p);
 }else if(kind==='thrust'){
  for(const n of ['hips','spine','chest','head'])pose[n][1]*=.45;
  pose.offset[2]+=.06*Math.sin(Math.PI*p)**2;
  pose.grip=curve('grip',[[.26,-.20,-.34,.12],[.39,-.20,-.31,.12],[.50,-.075,-.25,.68],[.58,-.075,-.25,.65],[.78,-.18,-.33,.21]],p);
  pose.blade=curve('blade',[[.24,-.03,.03,0],[.39,-.01,.015,0],[.50,0,.02,0],[.61,0,.02,0],[.82,.13,.60,0]],p);
 }else if(kind==='heavy'){
  pose.hips[1]*=.35;pose.spine[1]*=.25;pose.chest[1]*=.25;
  pose.hips[0]-=.10*Math.sin(Math.PI*p)**2;pose.spine[0]-=.07*Math.sin(Math.PI*p)**2;
  pose.offset[1]-=.035*Math.sin(Math.PI*p)**2;
  pose.grip=curve('grip',[[.25,-.20,.07,.08],[.39,-.16,.14,.11],[.50,-.055,-.24,.51],[.65,.05,-.57,.37],[.79,.015,-.49,.28]],p);
  pose.blade=curve('blade',[[.25,-.35,1.4,-.05],[.39,-.2,1.6,0],[.50,0,-.13,0],[.65,.05,-1.13,.06],[.79,.10,-.75,.08]],p);
 }
 return pose;
}
export function applyAuthoredSword(runtime,c,kind,phase,definition){
 const contact=definition?.contact??.5;
 applySwordPose(runtime,c,sampleSwordPose(kind,phase,contact),slashTime(phase,contact));
}
