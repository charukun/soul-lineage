/** Original sword/slash choreography. +Z forward, +X anatomical left.
 * Pose times share the game's contact clock; no actor displacement or game state.
 * Source: visual study of user reference 1000003098.mp4, not extracted motion data.
 */
import * as T from '../vendor/three.js';

export const SLASH_SECONDS = .66;
export const SLASH_TIMING = Object.freeze({active:Object.freeze([.35,.64]),contact:.50,launch:.34,plant:.49,chain:.86,lead:1});
export const SLASH_REVISION = 'shino-slash-3';
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

const body = {
  // Ground -> pelvis -> chest -> blade. The long loading arc is followed by a
  // short release; recovery moves the feet again instead of sliding planted legs.
  hips:[[0,0,0,0],[.23,-.10,-.49,-.07],[.34,-.15,-.48,-.08],[.44,-.21,.05,-.06],[.50,-.22,.39,-.025],[.62,-.15,.65,.065],[.76,-.08,.51,.035],[1,0,0,0]],
  spine:[[0,0,0,0],[.28,.045,-.21,.085],[.38,.025,-.25,.055],[.50,-.14,.12,-.10],[.62,-.11,.26,-.09],[.80,-.03,.13,-.035],[1,0,0,0]],
  chest:[[0,0,0,0],[.30,.055,-.14,.06],[.40,.025,-.17,.045],[.50,-.065,.07,-.07],[.63,-.09,.16,-.055],[.80,-.02,.07,-.02],[1,0,0,0]],
  head:[[0,0,0,0],[.34,-.015,.46,0],[.50,.085,-.29,.045],[.66,.05,-.56,.035],[.82,.02,-.23,0],[1,0,0,0]],
  offset:[[0,0,-.028,0],[.22,-.065,-.17,-.065],[.34,-.045,-.205,-.01],[.47,.055,-.175,.27],[.56,.08,-.16,.34],[.70,.06,-.10,.33],[.84,.025,-.06,.16],[1,0,-.028,0]],
  grip:[[0,-.19,-.37,.35],[.23,-.34,-.13,.17],[.36,-.37,-.055,.18],[.44,-.40,-.10,.29],[.50,-.055,-.22,.55],[.59,.31,-.40,.43],[.72,.28,-.45,.27],[.84,.11,-.38,.30],[1,-.19,-.37,.35]],
  blade:[[0,.398,1.15,0],[.25,-1.80,1.0,-.40],[.38,-1.95,.82,-.50],[.44,-1.42,.38,-.45],[.50,0,.02,-.15],[.59,1.58,-.33,.27],[.72,2.02,-.42,.42],[.84,1.45,.35,.32],[1,.398,1.15,0]],
  shield:[[0,.25,-.32,.17],[.30,.34,-.27,.21],[.50,.28,-.27,.21],[.65,.37,-.30,.07],[.84,.30,-.31,.13],[1,.25,-.32,.17]],
  lead:[[0,.045,0,.10],[.16,.045,0,.10],[.31,.095,.115,.30],[.46,.15,0,.61],[.73,.15,0,.61],[.87,.09,.105,.35],[1,.045,0,.10]],
  rear:[[0,-.045,0,-.10],[.35,-.065,0,-.10],[.53,-.09,.085,.035],[.72,-.07,0,.20],[.79,-.07,0,.20],[.90,-.055,.075,.07],[1,-.045,0,-.10]],
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
  const pose=sampleSlashPose(phase,definition.contact);
  return applySwordPose(runtime,c,pose,slashTime(phase,definition.contact));
}

/** Shared rig application: authored keys choose the pose, IK keeps anatomy/grip. */
export function applySwordPose(runtime,c,pose,p) {
  const s=c.legLength/.82;
  const flip=c.vrm.meta.metaVersion==='1'?-1:1;
  for(const name of ['hips','spine','chest','head']){
    const b=c.bones[name];if(!b)continue;
    const [x,y,z]=pose[name];
    b.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x*flip,y,z*flip,'YXZ'))).normalize();
  }
  c.bones.hips.position.add(new T.Vector3(...pose.offset).multiplyScalar(s));
  c.root.updateMatrixWorld(true);
  for(const [side,key]of [['left','lead'],['right','rear']]){
    const foot=pose.feet?.[side];
    const target=foot?new T.Vector3(foot.x*s,c.neutralPoints[side+'Foot'].y+foot.y*s,foot.z*s):c.neutralPoints[side+'Foot'].clone().add(new T.Vector3(...pose[key]).multiplyScalar(s));
    const poleYaw=(foot?.yaw??0)*.6;
    runtime.solve(c,side,'leg',target,new T.Vector3(Math.sin(poleYaw)+(side==='left'?.15:-.15),0,Math.cos(poleYaw)),true);
    // Keep the sole level during support, while the rear heel pivots into the cut.
    const yaw=foot?.yaw??pose.hips[1]*(side==='right'?.70:.20);
    const heel=foot?.pitch??(side==='right'?poseCurve([[0,0],[.35,0],[.60,.16],[.78,.08],[1,0]],p)[0]:0);
    runtime.setWorldQ(c,side+'Foot',new T.Quaternion().setFromEuler(new T.Euler(-heel,yaw,0,'YXZ')));
  }
  const [x,y,z]=pose.grip,[yaw,elevation,roll]=pose.blade;
  const carry=new T.Vector3(pose.offset[0],(pose.offset[1]+.028)*.72,pose.offset[2]).multiplyScalar(s);
  const grip=new T.Vector3(x*s,c.shoulderY+y*s,z*s).add(carry);
  const dir=new T.Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation));
  runtime.attachHands(c,'sword',grip,dir,roll,1);
  const [lx,ly,lz]=pose.shield;
  runtime.solve(c,'left','arm',new T.Vector3(lx*s,c.shoulderY+ly*s,lz*s).add(carry),new T.Vector3(.6,-1,0));
  c.root.updateMatrixWorld(true);
}
