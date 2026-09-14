import * as T from '../vendor/three.js';
import {HumanoidRuntime as NaturalHumanoidRuntime} from './humanoid-natural-stance.js';
import {
  MOTION_QUALITY_PHASE2_VERSION,
  attackMotionProfile,
  angleDelta,
  distanceMatchedPhase,
  motionQualitySnapshot,
  orientationWarpDistribution,
  strideScaleFor,
  transitionInertialWeight
} from './motion-quality-phase2.js';

const Q=()=>new T.Quaternion();
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const WORLD_UP=V(0,1,0);
const INERTIAL_BONES=['hips','spine','chest','upperChest','neck','head'];

function copyPose(c,names=INERTIAL_BONES){
  return Object.fromEntries(names.filter(name=>c.bones[name]).map(name=>[name,c.bones[name].quaternion.clone()]));
}

function boundedResidual(previous,current,maxAngle=.105){
  const residual=previous.clone().multiply(current.clone().invert()).normalize();
  if(residual.w<0)residual.set(-residual.x,-residual.y,-residual.z,-residual.w);
  const angle=new T.Quaternion().angleTo(residual);
  if(angle>maxAngle)residual.slerpQuaternions(Q(),residual,maxAngle/angle);
  return residual.normalize();
}

function bodyYaw(bone,angle){
  if(!bone||Math.abs(angle)<1e-8)return;
  bone.quaternion.multiply(Q().setFromAxisAngle(WORLD_UP,angle)).normalize();
}

export class HumanoidRuntime extends NaturalHumanoidRuntime{
  tick(a,dt){
    if(!a?.hero)return super.tick(a,dt);
    const phaseBefore=a._humanoidPhase||0;
    const previous=a._motionQualityPosition?{...a._motionQualityPosition}:null;
    const previousYaw=Number.isFinite(a._motionQualityYaw)?a._motionQualityYaw:null;
    super.tick(a,dt);

    const speed=Math.hypot(a.vx||0,a.vz||0);
    const moving=!a.attack&&!a.dead&&!a.recovery&&speed>.10&&this.current;
    if(moving&&previous&&Number.isFinite(dt)&&dt>0){
      const current={x:a.x,z:a.z},locomotion=this.current.locomotion[speed>2.4?'run':'walk'];
      if(locomotion?.cycleDistance>0&&locomotion?.duration>0){
        const dx=current.x-previous.x,dz=current.z-previous.z;
        const projected=dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw);
        const fallbackProjected=(a.vx||0)*Math.sin(a.yaw)+(a.vz||0)*Math.cos(a.yaw);
        const direction=(Math.abs(projected)>1e-7?projected:fallbackProjected)<-.07?-1:1;
        const matched=distanceMatchedPhase({phase:phaseBefore,from:previous,to:current,cycleDistance:locomotion.cycleDistance,direction});
        const stride=strideScaleFor({distance:matched.distance,dt,cycleDistance:locomotion.cycleDistance,clipDuration:locomotion.duration});
        a._humanoidPhase=matched.phase;
        a._motionQualityStrideScale=stride.scale;
        this.current.phase2DistanceMatch={...matched,mode:speed>2.4?'run':'walk',actualSpeed:stride.actualSpeed,authoredSpeed:stride.authoredSpeed};
        this.current.phase2Stride={...stride,mode:speed>2.4?'run':'walk'};
      }
    }else if(a._motionQualityStrideScale!==1){
      a._motionQualityStrideScale=1;
      if(this.current)this.current.phase2Stride={scale:1,raw:1,actualSpeed:0,authoredSpeed:0,min:.82,max:1.16,mode:'settled'};
    }

    if(previousYaw!=null&&!a.attack&&!a.dead&&!a.recovery){
      const delta=angleDelta(previousYaw,a.yaw);
      if(Math.abs(delta)>.012)a._motionQualityAutoOrientation={delta,age:0,duration:.14};
    }
    if(a._motionQualityAutoOrientation){
      a._motionQualityAutoOrientation.age=Math.min(a._motionQualityAutoOrientation.duration,a._motionQualityAutoOrientation.age+Math.max(0,dt||0));
      a._motionQualityAutoOrientation.progress=a._motionQualityAutoOrientation.age/a._motionQualityAutoOrientation.duration;
      if(a._motionQualityAutoOrientation.progress>=1)a._motionQualityAutoOrientation=null;
    }

    if(a.attack&&this.current){
      try{
        this.current.phase2Attack=attackMotionProfile(a.attack.kind,{
          contact:this.api.clips?.[a.attack.kind]?.contact,
          duration:a.attack.motionDuration??this.api.strikes?.[a.attack.kind]?.duration,
          lunge:this.api.strikes?.[a.attack.kind]?.lunge
        });
      }catch{this.current.phase2Attack=null;}
    }else if(this.current)this.current.phase2Attack=null;

    a._motionQualityPosition={x:a.x,z:a.z};
    a._motionQualityYaw=a.yaw;
  }

  applyStrideWarp(c,a,d){
    if(!['walk','run'].includes(d.type))return;
    const scale=Number.isFinite(a._motionQualityStrideScale)?a._motionQualityStrideScale:1;
    c.phase2StrideScale=scale;
    if(Math.abs(scale-1)<1e-4)return;
    c.root.updateMatrixWorld(true);
    for(const side of ['left','right']){
      const name=side+'Foot',neutral=c.neutralPoints[name];
      if(!neutral||!c.bones[name])continue;
      const current=this.point(c,name),target=current.clone();
      target.z=neutral.z+(current.z-neutral.z)*scale;
      target.x=neutral.x+(current.x-neutral.x)*Math.min(1.06,Math.max(.94,scale));
      this.solve(c,side,'leg',target,V(0,0,1));
    }
    c.root.updateMatrixWorld(true);
  }

  ground(c,a,d,commit){
    this.applyStrideWarp(c,a,d);
    super.ground(c,a,d,commit);
  }

  captureWorldLocks(c,weapon){
    c.root.updateMatrixWorld(true);
    const feet=Object.fromEntries(['left','right'].filter(side=>c.bones[side+'Foot']).map(side=>[side,{
      position:this.point(c,side+'Foot'),
      quaternion:c.bones[side+'Foot'].getWorldQuaternion(Q())
    }]));
    const hands=weapon==='fist'?{}:Object.fromEntries(['left','right'].filter(side=>c.bones[side+'Hand']).map(side=>[side,{
      position:this.point(c,side+'Hand'),
      quaternion:c.bones[side+'Hand'].getWorldQuaternion(Q())
    }]));
    return{feet,hands};
  }

  restoreWorldLocks(c,locks,footYaw={}){
    c.root.updateMatrixWorld(true);
    for(const [side,lock] of Object.entries(locks.feet)){
      const footQ=Q().setFromAxisAngle(WORLD_UP,footYaw[side]||0).multiply(lock.quaternion);
      this.solve(c,side,'leg',lock.position,V(0,0,1));
      this.setWorldQ(c,side+'Foot',footQ);
      c.root.updateMatrixWorld(true);
    }
    for(const [side,lock] of Object.entries(locks.hands)){
      const shoulder=this.point(c,side+'UpperArm'),elbow=this.point(c,side+'LowerArm');
      let pole=elbow.clone().sub(shoulder);
      if(pole.lengthSq()<1e-8)pole=V(side==='left'?1:-1,-1,0);
      this.solve(c,side,'arm',lock.position,pole,true);
      this.setWorldQ(c,side+'Hand',lock.quaternion);
      c.root.updateMatrixWorld(true);
    }
  }

  applyOrientationWarp(c,a){
    const source=a._motionQualityOrientation??a._motionQualityAutoOrientation;
    if(!source||!Number.isFinite(source.delta)||!Number.isFinite(source.progress))return null;
    const distributed=orientationWarpDistribution(source.delta,source.progress);
    bodyYaw(c.bones.hips,distributed.hips);
    bodyYaw(c.bones.spine,distributed.spine);
    bodyYaw(c.bones.chest,distributed.chest);
    c.root.updateMatrixWorld(true);
    c.phase2Orientation=distributed;
    return distributed;
  }

  applyTransitionInertialization(c,key,clock){
    const current=copyPose(c);
    if(c.phase2LastKey!==key&&c.phase2LastPose){
      const residuals={};
      let maxResidual=0;
      for(const name of INERTIAL_BONES){
        if(!current[name]||!c.phase2LastPose[name])continue;
        residuals[name]=boundedResidual(c.phase2LastPose[name],current[name]);
        maxResidual=Math.max(maxResidual,Q().angleTo(residuals[name]));
      }
      c.phase2Inertial={key,start:clock,duration:.12,residuals,maxResidual};
    }
    c.phase2LastKey=key;

    const state=c.phase2Inertial;
    let diagnostic={active:false,weight:0,maxResidual:0,duration:.12};
    if(state&&state.key===key){
      const timing=transitionInertialWeight(Math.max(0,clock-state.start),state.duration);
      diagnostic={active:!timing.done,weight:timing.weight,maxResidual:state.maxResidual,duration:state.duration};
      if(timing.weight>1e-5){
        for(const [name,residual] of Object.entries(state.residuals)){
          const bone=c.bones[name];if(!bone)continue;
          const weighted=Q().slerpQuaternions(Q(),residual,timing.weight);
          bone.quaternion.premultiply(weighted).normalize();
        }
        c.root.updateMatrixWorld(true);
      }
      if(timing.done)c.phase2Inertial=null;
    }
    c.phase2InertialDiagnostic=diagnostic;
    return diagnostic;
  }

  sample(a,at=null,px=a.x,pz=a.z,commit=false){
    const result=super.sample(a,at,px,pz,commit),c=this.current;
    if(!result||!c||!commit)return result;
    const weapon=a.weapon||'sword',locks=this.captureWorldLocks(c,weapon),clock=a._humanoidClock||0;
    const inertial=this.applyTransitionInertialization(c,c.state||'unknown',clock);
    const orientation=this.applyOrientationWarp(c,a);
    this.restoreWorldLocks(c,locks,{
      left:orientation?.leftFoot||0,
      right:orientation?.rightFoot||0
    });
    c.vrm.update(0);c.root.updateMatrixWorld(true);
    c.phase2LastPose=copyPose(c);
    c.phase2Snapshot=motionQualitySnapshot({
      distanceMatch:c.phase2DistanceMatch??null,
      stride:c.phase2Stride??null,
      orientation:c.phase2Orientation??null,
      inertial,
      attack:c.phase2Attack??null,
      impact:a._motionQualityImpactBeat??null
    });
    return result;
  }

  report(){
    const c=this.current,base=super.report();
    return{...base,motionQualityPhase2:c?.phase2Snapshot??motionQualitySnapshot(),motionQualityPhase2Version:MOTION_QUALITY_PHASE2_VERSION};
  }
}
