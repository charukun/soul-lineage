/** Shared standing/gait polish. Uses the existing idle, walk, run and sword poses. */
import * as T from '../vendor/three.js';
import {sampleSlashPose,applySwordPose} from './authored-slash.js';
export const POSTURE_REVISION='shared-posture-1';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const gaitMix=speed=>smooth((speed-1.8)/1.4);
export const gaitDistance=(locomotion,speed)=>(locomotion?.walk?.cycleDistance||1.4)*(1-gaitMix(speed))+(locomotion?.run?.cycleDistance||2.5)*gaitMix(speed);

// Adapted from develop PR #156 (naturalArmPole). Keep the existing hand/socket
// position while choosing an elbow plane from anatomy, including rotated torsos.
export function naturalArmPole(runtime,c,side){
 const shoulder=runtime.point(c,side+'UpperArm'),elbow=runtime.point(c,side+'LowerArm'),hand=runtime.point(c,side+'Hand');
 const chest=runtime.point(c,c.bones.upperChest?'upperChest':'spine'),reach=hand.clone().sub(shoulder).normalize();
 const project=p=>{p.addScaledVector(reach,-p.dot(reach));return p.lengthSq()>1e-10?p.normalize():p;};
 const forward=hand.clone().sub(chest);forward.y=0;
 return project(elbow.sub(shoulder)).multiplyScalar(.22).addScaledVector(project(shoulder.clone().sub(chest)),.26).addScaledVector(project(forward),.12).addScaledVector(project(v(0,-1,0)),.65).normalize();
}
export function relaxHeldArms(runtime,c,weapon='sword'){
 for(const side of weapon==='sword'?['right','left']:['right']){
  const hand=runtime.point(c,side+'Hand'),q=c.bones[side+'Hand'].getWorldQuaternion(Q());
  runtime.solve(c,side,'arm',hand,naturalArmPole(runtime,c,side),true);runtime.setWorldQ(c,side+'Hand',q);
 }
 if(weapon==='sword'){c.bones.leftHand.quaternion.copy(c.rest.leftHand.q);runtime.curl(c,'left',.28);}
}

export function applyStandingPose(runtime,c,id='balanced',time=0){
 const cfg=MASTER_STANCES.find(row=>row.id===id)?.cfg||{},s=c.legLength/.82;
 const breath=Math.sin(time*Math.PI/2),settle=Math.sin(time*Math.PI/2)*.003;
 if(id==='normal'){
  c.bones.hips.position.y-=(.010+.0015*breath)*s;c.bones.hips.position.x+=settle*s;
  c.bones.spine.quaternion.multiply(Q().setFromAxisAngle(v(1,0,0),.003*breath));
  c.root.updateMatrixWorld(true);
  for(const side of ['left','right']){
   const sign=side==='left'?1:-1,target=c.neutralPoints[side+'Foot'].clone();target.x+=sign*.018*s;
   runtime.solve(c,side,'leg',target,v(sign*.12,0,1),true);runtime.setWorldQ(c,side+'Foot',Q().setFromAxisAngle(v(0,1,0),sign*.06));
   const shoulder=runtime.point(c,side+'UpperArm'),reach=shoulder.distanceTo(runtime.point(c,side+'LowerArm'))+runtime.point(c,side+'LowerArm').distanceTo(runtime.point(c,side+'Hand'));
   const hand=v(shoulder.x+sign*.080*s,shoulder.y-.95*reach,shoulder.z+.035*s);
   runtime.solve(c,side,'arm',hand,v(sign*.25,-.35,-1),true);c.bones[side+'Hand'].quaternion.copy(c.rest[side+'Hand'].q);runtime.curl(c,side,.13);
  }
  return;
 }
 const pose=sampleSlashPose(0),turn=-(cfg.half||0),weight=cfg.weight||0;
 pose.offset[0]=settle;pose.offset[1]-=(cfg.lower||0)+.0025*breath;pose.offset[2]=weight*.45;
 pose.hips[1]=turn*.45;pose.spine=[-(cfg.lean||0),turn*.35,.002*breath];pose.chest=[.004*breath,turn*.20,0];pose.head=[cfg.lean||0,-turn,0];
 const wide=cfg.wide||0;pose.lead[0]+=wide;pose.rear[0]-=wide;
 pose.lead[2]+=(cfg.light?.025:0)+weight*.15;pose.rear[2]-=cfg.light?.015:0;
 pose.grip[1]+=(cfg.high?.095:0)+.002*breath;pose.grip[2]-=cfg.high?.04:0;
 pose.shield[1]+=(cfg.high?.06:0)+.002*breath;
 if(cfg.draw){pose.grip=[-.27,-.44,.19];pose.blade=[.58,.73,.12];pose.reach=[.77];}
 applySwordPose(runtime,c,pose,0);relaxHeldArms(runtime,c);
 if(cfg.boxing){
  for(const side of ['left','right']){const sign=side==='left'?1:-1;runtime.solve(c,side,'arm',v(sign*.17*s,c.shoulderY-.11*s,(side==='left'?.26:.18)*s),v(sign*.55,-1,0),true);runtime.curl(c,side,1);}
 }
}

/** Preserve source foot timing and pelvis. Counter-swing is reduced only for the
 * weapon arm, leaving the free shoulder and elbow able to balance each step. */
export function polishGait(runtime,c,d){
 const run=gaitMix(d.speed??(d.type==='run'?3.9:1.65)),phase=d.time*Math.PI*2,flip=c.vrm.meta.metaVersion==='1'?-1:1;
 const add=(name,x,y,z)=>c.bones[name]?.quaternion.multiply(Q().setFromEuler(new T.Euler(x*flip,y,z*flip,'YXZ'))).normalize();
 add('spine',-.028*run,.025*Math.cos(phase),0);add('chest',-.018*run,-.018*Math.cos(phase),0);add('head',.036*run,-.012*Math.cos(phase),0);
 c.root.updateMatrixWorld(true);
}
export const MASTER_STANCES=Object.freeze([
  {id:'none',label:'未設定',cfg:{}},{id:'balanced',label:'自然体',cfg:{}},{id:'assault',label:'攻め主体',cfg:{lean:.07,lower:.025,weight:.07,stepTime:.88,stepSize:1.10,rest:.83}},
  {id:'defensive',label:'守り主体',cfg:{lean:-.04,lower:.05,weight:-.06,high:true,stepTime:1.12,stepSize:.78,rest:1.25}},
  {id:'patient',label:'後の先',cfg:{lean:-.015,lower:.025,weight:-.04,half:.16,stepTime:1.07,stepSize:.84,rest:1.18}},
  {id:'counter',label:'見切り重視',cfg:{lean:-.03,lower:.05,weight:-.03,half:.23,high:true,stepTime:1.03,stepSize:.86,rest:1.12}},
  {id:'elusive',label:'回避重視',cfg:{lower:.02,half:.18,light:true,stepTime:.83,stepSize:.90,rest:.91}},
  {id:'steadfast',label:'不動',cfg:{lower:.085,wide:.055,stepTime:1.22,stepSize:.65,rest:1.35}},
  {id:'survival',label:'生存優先',cfg:{lean:-.04,lower:.035,weight:-.07,high:true,stepTime:1.06,stepSize:.90,rest:1.18}},
  {id:'escort',label:'護衛優先',cfg:{lower:.065,wide:.04,high:true,stepTime:1.03,stepSize:.82,rest:1.10}},
  {id:'boxer',label:'拳闘のリズム',cfg:{lower:.025,half:.12,light:true,boxing:true,stepTime:.76,stepSize:.83,rest:.72}},
  {id:'sideways',label:'半身の構え',cfg:{lower:.065,half:.24,stepTime:1.05,stepSize:.87,rest:1.12}},
  {id:'draw',label:'静の構え',cfg:{lower:.04,draw:true,stepTime:1.10,stepSize:.85,rest:1.28}}
]);
