/** Companion cuts for Shino. Same canonical rig/IK as the approved slash. */
import {poseCurve,sampleSlashPose,slashTime,applySwordPose,SLASH_SECONDS,SLASH_TIMING} from './authored-slash.js';
export const SWORD_REVISION='shared-sword-2';
export const SWORD_MOVES=Object.freeze(Object.fromEntries([
 ['slash','流し斬り',SLASH_SECONDS],['back','斬り返し',.69],['thrust','刺し貫く',.67],['uppercut','斬り上げる',.74],['heavy','叩き斬る',.98],
].map(([kind,label,seconds])=>[kind,Object.freeze({kind,label,seconds,timing:SLASH_TIMING})])));
export function swordClipInSeconds(clip,kind){
 const move=SWORD_MOVES[kind];if(!move)return clip;
 const result=clip.clone();for(const track of result.tracks)track.scale(move.seconds/clip.duration);
 result.resetDuration();return result;
}
export const AUTHORED_SWORD_KINDS=Object.freeze(['back','uppercut','thrust','heavy']);
const guard=sampleSlashPose(0);
const curve=(name,rows,p)=>poseCurve([[0,...guard[name]],...rows,[1,...guard[name]]],p);
export function sampleSwordPose(kind,phase,contact=.5){
 const p=slashTime(phase,contact),pose=sampleSlashPose(p);
 if(kind==='back'){
  for(const n of ['hips','spine','chest','head'])pose[n][1]*=-.85;
  pose.offset[0]*=-.5;
  pose.grip=curve('grip',[[.27,.30,-.43,.28],[.38,.34,-.39,.30],[.50,.015,-.25,.53],[.64,-.36,-.14,.33],[.80,-.32,-.22,.26]],p);
  pose.blade=curve('blade',[[.27,1.85,-.35,.40],[.38,1.75,-.25,.40],[.50,0,.16,0],[.64,-1.65,.65,-.32],[.80,-1.35,.83,-.22]],p);
 }else if(kind==='uppercut'){
  pose.hips[1]*=.65;pose.spine[0]*=.75;pose.offset[1]-=.035*Math.sin(Math.PI*p);
  pose.grip=curve('grip',[[.27,-.32,-.55,.26],[.38,-.33,-.52,.30],[.50,-.07,-.27,.55],[.64,.12,.06,.38],[.80,.02,-.02,.30]],p);
  pose.blade=curve('blade',[[.27,-.7,-1.10,-.18],[.38,-.5,-.90,-.20],[.50,0,.12,0],[.64,.55,1.2,.10],[.80,.4,1.25,.08]],p);
 }else if(kind==='thrust'){
  for(const n of ['hips','spine','chest','head'])pose[n][1]*=.45;
  pose.offset[2]+=.06*Math.sin(Math.PI*p)**2;
  // Keep the chamber outside the rib cage and drive with the existing planted
  // leg/pelvis cycle. The Lab must not strip those lower-body tracks.
  pose.grip=curve('grip',[[.26,-.24,-.34,.24],[.39,-.25,-.31,.25],[.50,-.12,-.25,.65],[.58,-.12,-.25,.62],[.78,-.23,-.33,.31]],p);
  pose.blade=curve('blade',[[.24,-.03,.03,0],[.39,-.01,.015,0],[.50,0,.02,0],[.61,0,.02,0],[.82,.13,.60,0]],p);
 }else if(kind==='heavy'){
  pose.hips[1]*=.35;pose.spine[1]*=.25;pose.chest[1]*=.25;
  pose.hips[0]-=.10*Math.sin(Math.PI*p)**2;pose.spine[0]-=.07*Math.sin(Math.PI*p)**2;
  pose.offset[1]-=.035*Math.sin(Math.PI*p)**2;
  pose.grip=curve('grip',[[.25,-.24,.07,.20],[.39,-.22,.12,.23],[.50,-.10,-.24,.55],[.65,.02,-.54,.44],[.79,-.06,-.46,.34]],p);
  pose.blade=curve('blade',[[.25,-.35,1.4,-.05],[.39,-.2,1.6,0],[.50,0,-.13,0],[.65,.05,-1.13,.06],[.79,.10,-.75,.08]],p);
 }
 return pose;
}
export function applyAuthoredSword(runtime,c,kind,phase,definition){
 const contact=definition?.contact??.5;
 applySwordPose(runtime,c,sampleSwordPose(kind,phase,contact),slashTime(phase,contact));
}
