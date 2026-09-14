/** Original sword/slash choreography. +Z forward, +X anatomical left.
 * Pose times share the game's contact clock; no actor displacement or game state.
 * Source: visual study of user reference 1000003098.mp4, not extracted motion data.
 */
import * as T from '../vendor/three.js';

export const SLASH_SECONDS = .66;
export const SLASH_TIMING = Object.freeze({active:Object.freeze([.35,.64]),contact:.50,launch:.34,plant:.49,chain:.86,lead:1});
// Free hand envelope reconciled with develop PR #156.
export const SWORD_FREE_GUARD=Object.freeze([.16,-.29,.20]);
export const SLASH_REVISION = 'shino-slash-5';
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
  reach:[[0,.82],[.23,.76],[.36,.79],[.50,.965],[.64,.88],[.82,.80],[1,.82]],
  // Ground -> pelvis -> chest -> blade. The long loading arc is followed by a
  // short release; recovery moves the feet again instead of sliding planted legs.
  hips:[[0,0,0,0],[.23,-.10,-.49,-.07],[.34,-.15,-.48,-.08],[.44,-.21,.05,-.06],[.50,-.28,.39,-.045],[.62,-.15,.65,.065],[.76,-.08,.51,.035],[1,0,0,0]],
  spine:[[0,0,0,0],[.28,.045,-.21,.085],[.38,.025,-.25,.055],[.50,-.18,.12,-.10],[.62,-.11,.26,-.09],[.80,-.03,.13,-.035],[1,0,0,0]],
  chest:[[0,0,0,0],[.30,.055,-.14,.06],[.40,.025,-.17,.045],[.50,-.065,.07,-.07],[.63,-.09,.16,-.055],[.80,-.02,.07,-.02],[1,0,0,0]],
  head:[[0,0,0,0],[.34,-.015,.46,0],[.50,.085,-.29,.045],[.66,.05,-.56,.035],[.82,.02,-.23,0],[1,0,0,0]],
  offset:[[0,0,-.028,0],[.22,-.065,-.215,-.065],[.34,-.045,-.255,-.01],[.47,.055,-.245,.27],[.56,.08,-.22,.34],[.70,.06,-.17,.33],[.84,.025,-.06,.16],[1,0,-.028,0]],
  grip:[[0,-.19,-.37,.35],[.23,-.38,-.23,.12],[.36,-.43,-.20,.08],[.44,-.42,-.18,.27],[.50,-.055,-.22,.66],[.59,.31,-.40,.53],[.72,.28,-.45,.30],[.84,.11,-.38,.30],[1,-.19,-.37,.35]],
  blade:[[0,.398,1.15,0],[.25,-2.10,.36,-.36],[.38,-2.22,.28,-.46],[.44,-1.52,.20,-.35],[.50,0,.02,-.15],[.59,1.58,-.33,.27],[.72,2.02,-.42,.42],[.84,1.45,.35,.32],[1,.398,1.15,0]],
  // The free hand compresses toward the ribs during release, then opens back
  // into guard. It counterbalances the sword rather than presenting a flat palm.
  shield:[[0,...SWORD_FREE_GUARD],[.30,.25,-.24,.17],[.50,.24,-.26,.13],[.65,.26,-.28,.10],[.84,.23,-.28,.17],[1,...SWORD_FREE_GUARD]],
  lead:[[0,.045,0,.10],[.16,.045,0,.10],[.31,.12,.035,.31],[.46,.19,0,.61],[.73,.19,0,.61],[.87,.11,.045,.35],[1,.045,0,.10]],
  rear:[[0,-.045,0,-.10],[.35,-.065,0,-.10],[.53,-.09,.035,.035],[.72,-.07,0,.20],[.79,-.07,0,.20],[.90,-.055,.035,.07],[1,-.045,0,-.10]],
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
    let [x,y,z]=pose[name];
    if(name==='head'){
      // Keep attention on the opponent while hips/chest lead the cut. Preserve
      // authored guard endpoints and some follow-through, rather than freezing
      // the neck in world space or turning the face with every torso accent.
      const targetYaw=clamp(-(pose.hips[1]+pose.spine[1]+pose.chest[1]),-.9,.9);
      const focus=.8*Math.sin(Math.PI*p)**2;
      y+=(targetYaw-y)*focus;
    }
    b.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x*flip,y,z*flip,'YXZ'))).normalize();
  }
  c.bones.hips.position.add(new T.Vector3(...pose.offset).multiplyScalar(s));
  c.root.updateMatrixWorld(true);
  for(const [side,key]of [['left','lead'],['right','rear']]){
    const foot=pose.feet?.[side];
    const target=foot?new T.Vector3(foot.x*s,c.neutralPoints[side+'Foot'].y+foot.y*s,foot.z*s):c.neutralPoints[side+'Foot'].clone().add(new T.Vector3(...pose[key]).multiplyScalar(s));
    // Place the sole on its authored height inside a reachable horizontal arc.
    // Letting IK clamp a distant ground target instead raises a rigid straight leg.
    const hip=runtime.point(c,side+'UpperLeg'),knee=runtime.point(c,side+'LowerLeg'),ankle=runtime.point(c,side+'Foot');
    const reach=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.985;
    const dy=hip.y-target.y,horizontal=new T.Vector3(target.x-hip.x,0,target.z-hip.z);
    const maxHorizontal=Math.sqrt(Math.max(0,reach*reach-dy*dy));
    if(horizontal.length()>maxHorizontal){horizontal.setLength(maxHorizontal);target.x=hip.x+horizontal.x;target.z=hip.z+horizontal.z;}
    // The knee follows the same support-foot heading as the sole. A fixed +Z
    // pole left the shin facing forward while the pelvis/rear heel turned,
    // producing an inward, crossed-knee silhouette in the release/recovery.
    const poleYaw=foot?.yaw??pose.hips[1]*(side==='right'?.70:.20);
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
  // Load with a bent elbow, extend through contact, then fold into recovery.
  // A phase-specific reach cap avoids hitting the same IK limit for every pose.
  const reach=pose.reach?.[0]??.965;
  runtime.attachHands(c,'sword',grip,dir,roll,1,null,1,reach);
  const [lx,ly,lz]=pose.shield;
  const torsoYaw=(pose.hips[1]+pose.spine[1]+pose.chest[1])*.75;
  const up=new T.Vector3(0,1,0),free=new T.Vector3(lx*s,ly*s,lz*s).applyAxisAngle(up,torsoYaw);
  free.y+=c.shoulderY;free.add(carry);
  const shoulder=runtime.point(c,'leftUpperArm'),elbow=runtime.point(c,'leftLowerArm'),hand=runtime.point(c,'leftHand');
  const maxFreeReach=(shoulder.distanceTo(elbow)+elbow.distanceTo(hand))*.90;
  const extension=free.clone().sub(shoulder);if(extension.length()>maxFreeReach)free.copy(shoulder).add(extension.setLength(maxFreeReach));
  runtime.solve(c,'left','arm',free,new T.Vector3(.6,-1,0).applyAxisAngle(up,torsoYaw));
  c.bones.leftHand.quaternion.copy(c.rest.leftHand.q);
  runtime.curl(c,'left',poseCurve([[0,.28],[.30,.50],[.50,.62],[.70,.54],[1,.28]],p)[0]);
  c.root.updateMatrixWorld(true);
}
