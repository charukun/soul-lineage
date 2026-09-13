/** Original sword/slash choreography. +Z forward, +X anatomical left.
 * Pose times share the game's contact clock; no actor displacement or game state.
 * Source: visual study of user reference 1000003098.mp4, not extracted motion data.
 */
import * as T from '../vendor/three.js';

export const SLASH_SECONDS = .66;
export const SLASH_TIMING = Object.freeze({active:Object.freeze([.35,.64]),contact:.50,launch:.34,plant:.49,chain:.86,lead:1});
export const SLASH_REVISION = 'shino-slash-1';
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
  // Hips lead the chest; the weapon stays loaded until the forward foot lands.
  hips:[[0,0,0,0],[.22,-.04,-.32,-.035],[.34,-.09,-.36,-.045],[.44,-.12,.04,-.035],[.50,-.14,.35,-.02],[.62,-.10,.53,.025],[.78,-.055,.38,.015],[1,0,0,0]],
  spine:[[0,0,0,0],[.26,.025,-.16,.045],[.38,-.015,-.20,.04],[.50,-.10,.15,-.07],[.62,-.085,.27,-.06],[.80,-.03,.16,-.025],[1,0,0,0]],
  chest:[[0,0,0,0],[.30,.04,-.14,.03],[.40,.015,-.16,.015],[.50,-.05,.08,-.06],[.62,-.07,.19,-.045],[.80,-.015,.09,-.015],[1,0,0,0]],
  head:[[0,0,0,0],[.34,-.015,.33,0],[.50,.055,-.28,.04],[.66,.04,-.44,.025],[.82,.02,-.22,0],[1,0,0,0]],
  offset:[[0,0,-.028,0],[.24,-.040,-.135,-.040],[.35,-.030,-.145,-.015],[.47,.035,-.115,.13],[.55,.045,-.115,.16],[.70,.025,-.070,.115],[.84,.013,-.048,.055],[1,0,-.028,0]],
  // These are hand targets, not a generic circular blade orbit.
  grip:[[0,-.19,-.37,.35],[.22,-.36,-.15,.075],[.35,-.42,-.10,.005],[.44,-.40,-.14,.25],[.50,-.055,-.27,.49],[.59,.32,-.44,.36],[.72,.31,-.52,.10],[.84,.15,-.44,.20],[1,-.19,-.37,.35]],
  // Blade direction is spherical (yaw/elevation), with the cutting plane rolling
  // through the wrist instead of a direction-vector lerp collapsing at opposition.
  blade:[[0,.398,1.15,0],[.25,-1.68,.94,-.38],[.37,-1.83,.82,-.52],[.44,-1.40,.38,-.48],[.50,0,.02,-.15],[.59,1.47,-.30,.25],[.72,1.94,-.40,.46],[.84,1.50,.30,.36],[1,.398,1.15,0]],
  shield:[[0,.25,-.32,.17],[.30,.24,-.28,.21],[.50,.29,-.29,.19],[.65,.34,-.28,.14],[.84,.29,-.31,.17],[1,.25,-.32,.17]],
  lead:[[0,.045,0,.10],[.16,.045,0,.10],[.31,.070,.065,.19],[.46,.10,0,.34],[.73,.10,0,.34],[.87,.070,.045,.22],[1,.045,0,.10]],
  rear:[[0,-.045,0,-.10],[.35,-.070,0,-.10],[.56,-.075,.010,-.105],[.72,-.045,.018,-.06],[.88,-.045,0,-.045],[1,-.045,0,-.10]],
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
  const grip=new T.Vector3(x*s,c.shoulderY+y*s,z*s);
  const dir=new T.Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation));
  runtime.attachHands(c,'sword',grip,dir,roll,1);
  const [lx,ly,lz]=pose.shield;
  runtime.solve(c,'left','arm',new T.Vector3(lx*s,c.shoulderY+ly*s,lz*s),new T.Vector3(.6,-1,0));
  c.root.updateMatrixWorld(true);
}
