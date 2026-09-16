/** Original sword/slash choreography. +Z forward, +X anatomical left.
 * Pose times share the game's contact clock; no actor displacement or game state.
 * Source: visual study of user reference 1000003098.mp4, not extracted motion data.
 */
import * as T from '../vendor/three.js';

export const SLASH_SECONDS = .66;
export const SLASH_TIMING = Object.freeze({active:Object.freeze([.35,.64]),contact:.50,launch:.34,plant:.49,chain:.86,lead:1});
export const SLASH_REVISION = 'shino-slash-2';
export const SWORD_FREE_GUARD = Object.freeze([.16,-.29,.20]);
export const SLASH_ROOT_TRAVEL = Object.freeze({forward:.55,standoff:1.05,source:'controller-owned-bounded-warp',units:'world-metres',authoritative:false});
export const SLASH_WARP_WINDOW = Object.freeze({turnEnd:.14,warpStart:.18,contact:SLASH_TIMING.contact,maxDistance:.55,maxAcquireDistance:2.60,maxAcquireAngle:Math.PI*.75});
const clamp = (x,a=0,b=1)=>Math.min(b,Math.max(a,x));

// Monotone cubic interpolation keeps momentum through intermediate poses without
// overshooting anatomical targets. Only intentional holds have zero tangents.
export function poseCurve(rows, t) {
  if(t<=rows[0][0])return rows[0].slice(1);
  if(t>=rows.at(-1)[0])return rows.at(-1).slice(1);
  let i=0;while(t>rows[i+1][0])i++;
  const a=rows[i],b=rows[i+1],h=b[0]-a[0],u=(t-a[0])/h;
  const slope=(k,j)=>{
    if(k===0||k===rows.length-1)return 0;
    const left=rows[k][0]-rows[k-1][0],right=rows[k+1][0]-rows[k][0];
    const d0=(rows[k][j]-rows[k-1][j])/left,d1=(rows[k+1][j]-rows[k][j])/right;
    if(d0*d1<=0)return 0;
    const w0=2*right+left,w1=right+2*left;
    return (w0+w1)/(w0/d0+w1/d1);
  };
  return a.slice(1).map((v,j)=>{
    j++;
    return (2*u*u*u-3*u*u+1)*v+(u*u*u-2*u*u+u)*h*slope(i,j)
      +(-2*u*u*u+3*u*u)*b[j]+(u*u*u-u*u)*h*slope(i+1,j);
  });
}

// v2 keeps the combat clock fixed while making the force chain legible at 1x:
// settle low, counter-rotate through the torso, release through contact, then brake
// through the whole body instead of snapping the sword back to guard.
const body = {
  hips:[[0,0,0,0],[.20,-.05,-.28,-.04],[.32,-.12,-.42,-.065],[.39,-.14,-.44,-.06],[.46,-.13,-.05,-.04],[.50,-.14,.36,-.015],[.60,-.10,.58,.035],[.72,-.065,.48,.025],[.84,-.035,.24,.015],[1,0,0,0]],
  spine:[[0,0,0,0],[.22,.04,-.10,.06],[.34,.02,-.25,.06],[.40,-.02,-.27,.05],[.50,-.12,.13,-.09],[.60,-.11,.32,-.08],[.72,-.07,.28,-.05],[.84,-.03,.13,-.02],[1,0,0,0]],
  chest:[[0,0,0,0],[.24,.05,-.08,.04],[.34,.04,-.22,.04],[.40,.01,-.25,.03],[.50,-.07,.12,-.08],[.60,-.09,.26,-.065],[.72,-.05,.24,-.035],[.84,-.02,.10,-.015],[1,0,0,0]],
  head:[[0,0,0,0],[.30,-.01,.18,0],[.40,.015,.24,.01],[.50,.04,-.10,.025],[.62,.035,-.22,.02],[.76,.02,-.18,0],[.88,.01,-.08,0],[1,0,0,0]],
  offset:[[0,0,-.028,0],[.20,-.035,-.14,-.035],[.34,-.04,-.18,-.015],[.40,-.02,-.175,.03],[.47,.04,-.13,.145],[.53,.055,-.12,.19],[.66,.035,-.085,.15],[.80,.018,-.055,.075],[.90,.008,-.040,.03],[1,0,-.028,0]],
  grip:[[0,-.19,-.37,.35],[.20,-.34,-.16,.09],[.34,-.46,-.075,.02],[.40,-.45,-.09,.10],[.46,-.34,-.19,.32],[.50,-.02,-.28,.51],[.58,.36,-.43,.39],[.70,.35,-.52,.11],[.82,.18,-.45,.22],[1,-.19,-.37,.35]],
  blade:[[0,.398,1.15,0],[.22,-1.55,1.02,-.36],[.34,-1.88,.88,-.56],[.40,-1.86,.78,-.58],[.46,-1.30,.32,-.50],[.50,0,.00,-.14],[.57,1.58,-.34,.29],[.70,2.02,-.43,.50],[.82,1.58,.25,.38],[1,.398,1.15,0]],
  shield:[[0,...SWORD_FREE_GUARD],[.22,.12,-.23,.30],[.36,.10,-.20,.34],[.50,.34,-.21,.28],[.64,.39,-.17,.14],[.78,.32,-.21,.12],[.90,.23,-.26,.16],[1,...SWORD_FREE_GUARD]],
  lead:[[0,.045,0,.10],[.18,.045,0,.10],[.32,.075,.07,.22],[.46,.11,0,.38],[.72,.11,0,.38],[.86,.075,.045,.24],[1,.045,0,.10]],
  rear:[[0,-.045,0,-.10],[.34,-.075,0,-.12],[.52,-.09,.015,-.13],[.70,-.06,.025,-.08],[.86,-.048,.005,-.05],[1,-.045,0,-.10]],
};

export function slashTime(phase, contact=SLASH_TIMING.contact) {
  const c=clamp(Number.isFinite(contact)?contact:.5,.1,.9),p=clamp(phase);
  return p<=c ? .5*p/c : .5+.5*(p-c)/(1-c);
}
export function slashSupport(side, phase, contact) {
  const p=slashTime(phase,contact);
  return side==='left' ? p<.16||(p>=.46&&p<=.73)||p>=.99 : p<=.35||p>=.88;
}
export function sampleSlashPose(phase, contact) {
  const p=slashTime(phase,contact);
  return Object.fromEntries(Object.entries(body).map(([name,rows])=>[name,poseCurve(rows,p)]));
}

export function applyAuthoredSlash(runtime,c,phase,definition=SLASH_TIMING) {
  const pose=sampleSlashPose(phase,definition.contact),s=c.legLength/.82;
  const flip=c.vrm.meta.metaVersion==='1'?-1:1;
  for(const name of ['hips','spine','chest','head']){
    const b=c.bones[name];if(!b)continue;
    const [x,y,z]=pose[name];
    b.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x*flip,y,z*flip,'YXZ'))).normalize();
  }
  c.bones.hips.position.add(new T.Vector3(...pose.offset).multiplyScalar(s));
  c.root.updateMatrixWorld(true);
  for(const [side,key]of [['left','lead'],['right','rear']]){
    const target=c.neutralPoints[side+'Foot'].clone().add(new T.Vector3(...pose[key]).multiplyScalar(s));
    runtime.solve(c,side,'leg',target,new T.Vector3(side==='left'?.15:-.15,0,1),true);
    const p=slashTime(phase,definition.contact),yaw=pose.hips[1]*(side==='right'?.70:.20);
    const heel=side==='right'?poseCurve([[0,0],[.35,0],[.60,.16],[.78,.08],[1,0]],p)[0]:0;
    runtime.setWorldQ(c,side+'Foot',new T.Quaternion().setFromEuler(new T.Euler(-heel,yaw,0,'YXZ')));
  }
  const [x,y,z]=pose.grip,[yaw,elevation,roll]=pose.blade;
  const grip=new T.Vector3(x*s,c.shoulderY+y*s,z*s);
  const dir=new T.Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation));
  runtime.attachHands(c,'sword',grip,dir,roll,1);
  const freeHandQ=c.bones.leftHand?.getWorldQuaternion(new T.Quaternion());
  const [lx,ly,lz]=pose.shield;
  runtime.solve(c,'left','arm',new T.Vector3(lx*s,c.shoulderY+ly*s,lz*s),new T.Vector3(.6,-1,0));
  if(freeHandQ)runtime.setWorldQ(c,'leftHand',freeHandQ);
  c.root.updateMatrixWorld(true);
}
