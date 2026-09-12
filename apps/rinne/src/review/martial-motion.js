import { THREE as T } from '@soul/rendering';
import { solveTwoBone } from './pose-transfer.js';
import { createHandClosure } from './hand-shape.js';
const clamp=T.MathUtils.clamp;
const ease=x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
const rise=(t,a,b)=>ease((t-a)/(b-a));
const pulse=(t,a,b,c,d)=>rise(t,a,b)*(1-rise(t,c,d));
const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const STRAIGHT_PUNCH = Object.freeze({duration:1.45,phases:[['構え',0],['打ち出し',.36],['打点',.56],['戻り',.98]],authorship:'Original authored right straight; biomechanics-informed, not mocap or a specific school kata'});

/** A review-only reference. Does not replace shared gameplay motion/balance. */
export function createMartialClips(vrm) {
  const h=vrm.humanoid, bones=Object.fromEntries(Object.keys(h.normalizedHumanBones).map(n=>[n,h.getNormalizedBoneNode(n)]).filter(([,b])=>b));
  const saved=Object.entries(bones).map(([name,node])=>({name,node,p:node.position.clone(),q:node.quaternion.clone()}));
  h.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
  const rest=Object.fromEntries(Object.entries(bones).map(([name,node])=>[name,{p:node.position.clone(),q:node.quaternion.clone()}]));
  const flip=vrm.meta.metaVersion==='1'?-1:1;
  const local=world=>{const p=vrm.scene.worldToLocal(world.clone());p.x*=flip;p.z*=flip;return p;};
  const world=p=>vrm.scene.localToWorld(vec(p.x*flip,p.y,p.z*flip));
  const direction=p=>p.clone().set(p.x*flip,p.y,p.z*flip).applyQuaternion(vrm.scene.getWorldQuaternion(new T.Quaternion())).normalize();
  const point=name=>local(bones[name].getWorldPosition(vec()));
  const feet=Object.fromEntries(['left','right'].map(s=>[s,point(s+'Foot')]));
  const s=(point('hips').y-(feet.left.y+feet.right.y)/2)/.82;
  const arm={};for(const side of ['left','right'])arm[side]=point(side+'UpperArm').distanceTo(point(side+'LowerArm'))+point(side+'LowerArm').distanceTo(point(side+'Hand'));
  const fingerAxes={},handLong={},handRestWorld={};
  for(const side of ['left','right']) {
    const wrist=bones[side+'Hand'], index=bones[side+'IndexProximal'],little=bones[side+'LittleProximal'],middle=bones[side+'MiddleProximal'];
    const across=index&&little?index.getWorldPosition(vec()).sub(little.getWorldPosition(vec())).normalize():vec(0,1,0);
    handRestWorld[side]=wrist.getWorldQuaternion(new T.Quaternion());
    handLong[side]=(middle?middle.getWorldPosition(vec()).sub(wrist.getWorldPosition(vec())):direction(vec(side==='right'?1:-1,0,0))).normalize();
    for(const finger of ['Index','Middle','Ring','Little','Thumb']) for(const seg of ['Metacarpal','Proximal','Intermediate','Distal']) {
      const name=side+finger+seg,b=bones[name]; if(b)fingerAxes[name]=across.clone().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert());
    }
  }
  const closures=Object.fromEntries(['left','right'].map(side=>[side,createHandClosure(bones,side)]));
  const reset=()=>{for(const[name,b]of Object.entries(bones)){b.position.copy(rest[name].p);b.quaternion.copy(rest[name].q);}};
  const rot=(name,x=0,y=0,z=0)=>{if(bones[name])bones[name].quaternion.copy(rest[name].q).multiply(new T.Quaternion().setFromEuler(new T.Euler(x*flip,y,z*flip,'YXZ')));};
  const setWorld=(bone,q)=>{bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(q).normalize();bone.updateWorldMatrix(false,true);};
  function limb(side,kind,target) {
    const suffix=kind==='leg'?['UpperLeg','LowerLeg','Foot']:['UpperArm','LowerArm','Hand'];
    const pole=kind==='leg'?vec(0,0,-1):vec(side==='left'?-.45:.45,-1,.12);
    solveTwoBone(...suffix.map(k=>bones[side+k]),world(target),direction(pole));
  }
  function foot(side,target,pitch=0,yaw=0) {
    limb(side,'leg',target);
    const q=vrm.scene.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(pitch*flip,yaw,0,'YXZ')));
    setWorld(bones[side+'Foot'],q);
  }
  function fist(side,pronation=0) {
    const wrist=bones[side+'Hand'],forearm=wrist.getWorldPosition(vec()).sub(bones[side+'LowerArm'].getWorldPosition(vec())).normalize();
    const q=new T.Quaternion().setFromUnitVectors(handLong[side],forearm).multiply(handRestWorld[side]);
    q.premultiply(new T.Quaternion().setFromAxisAngle(forearm,pronation));setWorld(wrist,q);
    closures[side](1);
  }
  function evaluate(kind,t){
    reset();
    if(kind==='normal') {
      const breath=Math.sin(t*Math.PI/2);
      bones.hips.position.y-=.012*s;
      rot('spine',-.01+.005*breath);rot('chest',.01);rot('head',.01);
      rot('leftUpperArm',0,-.04,1.35);rot('rightUpperArm',0,.04,-1.35);rot('leftLowerArm',0,-.14);rot('rightLowerArm',0,.14);
      vrm.scene.updateMatrixWorld(true);foot('left',feet.left);foot('right',feet.right);return;
    }
    // Small loading, then staggered pelvis/chest/arm peaks. Numeric timing is an art choice.
    const load=pulse(t,.18,.30,.34,.48),pelvis=pulse(t,.28,.46,.64,1.12),chest=pulse(t,.32,.50,.66,1.10),armDrive=pulse(t,.36,.56,.595,.98);
    const heel=pulse(t,.30,.51,.63,1.13);
    bones.hips.position.y-=s*(.062+.017*load-.006*pelvis);
    bones.hips.position.z-=flip*s*(.025+.065*pelvis);
    bones.hips.position.x+=flip*s*(.008*load-.016*pelvis);
    rot('hips',-.035,-.18-.06*load+.30*pelvis);
    rot('spine',-.06,.04+.09*chest);
    rot('chest',.025,.03+.13*chest);
    rot('neck',0,-.03-.05*chest);rot('head',.035,.08-.22*chest);
    // Shoulder is posed BEFORE arm IK, so solving the hand is the final positional operation.
    rot('leftShoulder',0,0,.06);rot('rightShoulder',-.025*chest,-.06*chest,-.05-.03*chest);
    vrm.scene.updateMatrixWorld(true);
    const left=feet.left.clone().add(vec(-.025*s,0,-.13*s)),right=feet.right.clone().add(vec(.025*s,.010*s*heel,.10*s));
    foot('left',left,0,-.03);foot('right',right,.13*heel,.15*heel);
    vrm.scene.updateMatrixWorld(true);
    const shoulderR=point('rightUpperArm'), shoulderL=point('leftUpperArm');
    const guardR=vec(.135*s,shoulderR.y+.04*s,-.18*s),guardL=vec(-.155*s,shoulderL.y+.04*s,-.19*s);
    // Target follows the shoulder; extension is bounded below straight-arm locking.
    const hit=shoulderR.clone().add(vec(-.045*s,-.018*s,-arm.right*.94));
    const target=guardR.lerp(hit,armDrive);
    limb('left','arm',guardL);limb('right','arm',target);
    fist('left',-.12);fist('right',-.10-.72*rise(t,.44,.56)*(1-rise(t,.63,.98)));
    vrm.scene.updateMatrixWorld(true);
  }
  function bake(name,kind,duration) {
    const times=[],values=Object.fromEntries(Object.keys(bones).map(n=>[n,[]])),hips=[];
    const count=Math.ceil(duration*60);
    for(let i=0;i<=count;i++){
      const time=duration*i/count;times.push(time);evaluate(kind,time);
      for(const[n,b]of Object.entries(bones)){
        const q=b.quaternion.toArray(),out=values[n];if(out.length&&q.reduce((v,x,j)=>v+x*out[out.length-4+j],0)<0)q.forEach((x,j)=>q[j]=-x);out.push(...q);
      }hips.push(...bones.hips.position.toArray());
    }
    const tracks=Object.entries(bones).map(([n,b])=>new T.QuaternionKeyframeTrack(b.uuid+'.quaternion',times,values[n]));tracks.push(new T.VectorKeyframeTrack(bones.hips.uuid+'.position',times,hips));
    const clip=new T.AnimationClip(name,duration,tracks);clip.userData={authorship:STRAIGHT_PUNCH.authorship};return clip;
  }
  try {return{bones,Attack:bake('Attack','punch',STRAIGHT_PUNCH.duration),NormalIdle:bake('NormalIdle','normal',4)};}
  finally{for(const{node,p,q}of saved){node.position.copy(p);node.quaternion.copy(q);}h.update();vrm.scene.updateMatrixWorld(true);}
}
