import * as T from '../vendor/three.js';
import {HumanoidRuntime as BaseHumanoidRuntime,weaponSockets} from './humanoid-core.js';

const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const Q=()=>new T.Quaternion();
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

function projectedDirection(vector,reach){
  const out=vector.clone().addScaledVector(reach,-vector.dot(reach));
  return out.lengthSq()>1e-10?out.normalize():out;
}

function stanceSides(weapon){
  const spec=weaponSockets[weapon]||weaponSockets.sword;
  return weapon==='sword'||spec.two?['right','left']:['right'];
}

/**
 * Derive an elbow bend direction from the character's current anatomy instead of a
 * fixed world-space down vector. The shoulder-to-chest direction keeps the elbow
 * outside the rib cage, while a small down/forward bias keeps a relaxed armed pose.
 */
export function naturalArmPole(runtime,c,side){
  const shoulder=runtime.point(c,side+'UpperArm');
  const elbow=runtime.point(c,side+'LowerArm');
  const hand=runtime.point(c,side+'Hand');
  const chestName=c.bones.upperChest?'upperChest':c.bones.chest?'chest':'spine';
  const chest=runtime.point(c,chestName);
  const reach=hand.clone().sub(shoulder);
  if(reach.lengthSq()<1e-10)return elbow.clone().sub(shoulder);
  reach.normalize();

  const authored=projectedDirection(elbow.clone().sub(shoulder),reach);
  const outward=projectedDirection(shoulder.clone().sub(chest),reach);
  const forward=hand.clone().sub(chest);forward.y=0;
  const forwardDir=forward.lengthSq()>1e-10?projectedDirection(forward.normalize(),reach):v();
  const down=projectedDirection(v(0,-1,0),reach);
  const pole=v();
  if(authored.lengthSq())pole.addScaledVector(authored,.44);
  if(outward.lengthSq())pole.addScaledVector(outward,.72);
  if(forwardDir.lengthSq())pole.addScaledVector(forwardDir,.10);
  if(down.lengthSq())pole.addScaledVector(down,.16);
  if(pole.lengthSq()<1e-10)return elbow.clone().sub(shoulder);
  return pole.normalize();
}

/** Same guard envelope used by the subtle torso support and arm bend correction.
 * A continuous weight removes the old 12%/82% IK on/off step. */
export function guardBlendStrength(a,progress=null){
  if(!a||a.reaction||a.recovery||a.dead||a.zanshin||(a.weapon||'sword')==='fist')return 0;
  const hasExplicitDraw=Number.isFinite(a.weaponDraw);
  if(!hasExplicitDraw&&!a.combatReady&&!a.weaponTransition)return 0;
  const draw=hasExplicitDraw?a.weaponDraw:(a.combatReady||a.weaponTransition?1:0);
  const held=smooth((draw-.25)/.75);
  if(!held)return 0;
  if(!a.attack)return held;
  if(!Number.isFinite(progress))return 0;
  if(progress<=.12)return held*(1-smooth(progress/.12));
  if(progress>=.82)return held*smooth((progress-.82)/.18);
  return 0;
}

export function shouldNaturalizeWeaponStance(a,progress=null){
  return guardBlendStrength(a,progress)>1e-6;
}

/** Small whole-body support for the ready silhouette. The same support fades out over
 * the opening guard and returns over the authored recovery, so attack->guard never
 * switches the shoulders underneath a world-locked wrist in one frame. */
export function readyBodyStrength(a,progress=null){
  if(!a||!(a.combatReady||a.weaponTransition)||Math.hypot(a.vx||0,a.vz||0)>.10)return 0;
  return guardBlendStrength(a,progress);
}

/** Static guard gets a small fencing base without changing locomotion or attack footwork. */
export function readyBaseStrength(a,descriptor=null){
  if(!a||descriptor?.type!=='combat'||a.air||Math.hypot(a.vx||0,a.vz||0)>.10)return 0;
  return readyBodyStrength(a,null);
}

export class HumanoidRuntime extends BaseHumanoidRuntime{
  captureHandLocks(c,weapon){
    c.root.updateMatrixWorld(true);
    return Object.fromEntries(stanceSides(weapon).filter(side=>c.bones[side+'Hand']).map(side=>[side,{
      position:this.point(c,side+'Hand'),
      quaternion:c.bones[side+'Hand'].getWorldQuaternion(Q())
    }]));
  }

  ground(c,a,d,commit){
    super.ground(c,a,d,commit);
    const strength=readyBaseStrength(a,d);
    c.readyBaseStrength=strength;
    if(!strength)return;
    const s=c.legLength/.82,flip=c.vrm.meta.metaVersion==='1'?-1:1;
    const hips=c.bones.hips;
    // Lower the centre of mass a little and turn the pelvis against the weapon-side
    // shoulder. The actor root never moves, so gameplay position/collision stay intact.
    hips.position.y-=.018*s*strength;
    hips.position.z+=.010*s*strength;
    hips.quaternion.multiply(Q().setFromEuler(new T.Euler(-.010*flip*strength,-.035*strength,0,'YXZ'))).normalize();
    c.root.updateMatrixWorld(true);
    for(const side of ['left','right']){
      const target=c.neutralPoints[side+'Foot'].clone();
      const lateral=(side==='left'?-1:1)*.055*s*strength;
      const stagger=(side==='left'?.110:-.075)*s*strength;
      target.x+=lateral;
      target.z+=stagger;
      this.solve(c,side,'leg',target,v(0,0,1));
    }
    c.root.updateMatrixWorld(true);
  }

  applyReadyBody(c,strength,commit=false){
    strength=clamp(strength);
    c.readyBodyStrength=strength;
    if(!strength)return;
    const flip=c.vrm.meta.metaVersion==='1'?-1:1;
    // A guard should read through the rib cage and shoulders, not as two arms pasted
    // onto an idle torso. Keep the turn small and counter it at the neck/head so gaze
    // stays on target while the weapon-side shoulder participates in the pose.
    const deltas={
      spine:new T.Euler(-.034*flip*strength,.030*strength,.008*flip*strength,'YXZ'),
      chest:new T.Euler(-.016*flip*strength,.042*strength,-.010*flip*strength,'YXZ'),
      upperChest:new T.Euler(0,.020*strength,-.006*flip*strength,'YXZ'),
      neck:new T.Euler(.012*flip*strength,-.032*strength,0,'YXZ'),
      head:new T.Euler(.020*flip*strength,-.060*strength,0,'YXZ')
    };
    for(const [name,euler]of Object.entries(deltas)){
      const bone=c.bones[name];if(!bone)continue;
      const delta=Q().setFromEuler(euler);
      bone.quaternion.multiply(delta).normalize();
      if(commit&&c.lastActual?.[name])c.lastActual[name].q.multiply(delta).normalize();
    }
    c.root.updateMatrixWorld(true);
  }

  naturalizeHeldWeapon(c,weapon,locks=null,strength=1){
    if(!c||weapon==='fist'||strength<=1e-6)return null;
    strength=clamp(strength);
    const sides=stanceSides(weapon);
    const metrics={weapon,strength,sides:[],maxHandDisplacement:0,maxHandAngleError:0};
    c.root.updateMatrixWorld(true);
    for(const side of sides){
      if(!c.bones[side+'UpperArm']||!c.bones[side+'LowerArm']||!c.bones[side+'Hand'])continue;
      const lock=locks?.[side],handTarget=lock?.position?.clone()??this.point(c,side+'Hand');
      const handQ=lock?.quaternion?.clone()??c.bones[side+'Hand'].getWorldQuaternion(Q());
      const shoulder=this.point(c,side+'UpperArm'),elbow=this.point(c,side+'LowerArm');
      const reach=handTarget.clone().sub(shoulder).normalize();
      const authored=projectedDirection(elbow.clone().sub(shoulder),reach);
      const natural=naturalArmPole(this,c,side);
      const pole=authored.lengthSq()&&strength<.999999?authored.clone().lerp(natural,strength).normalize():natural;
      this.solve(c,side,'arm',handTarget,pole,true);
      this.setWorldQ(c,side+'Hand',handQ);
      c.root.updateMatrixWorld(true);
      const handAfter=this.point(c,side+'Hand'),qAfter=c.bones[side+'Hand'].getWorldQuaternion(Q());
      const handDisplacement=handAfter.distanceTo(handTarget),handAngleError=qAfter.angleTo(handQ);
      metrics.maxHandDisplacement=Math.max(metrics.maxHandDisplacement,handDisplacement);
      metrics.maxHandAngleError=Math.max(metrics.maxHandAngleError,handAngleError);
      metrics.sides.push({side,pole:pole.toArray(),handDisplacement,handAngleError});
    }
    c.naturalStanceReport=metrics;
    return metrics;
  }

  syncVisibleArmSnapshot(c,weapon){
    if(!c.lastActual)return;
    for(const side of stanceSides(weapon))for(const bone of ['UpperArm','LowerArm','Hand']){
      const name=side+bone,current=c.bones[name],saved=c.lastActual[name];
      if(current&&saved){saved.q.copy(current.quaternion);saved.p.copy(current.position);}
    }
  }

  sample(a,at=null,px=a.x,pz=a.z,commit=false){
    const result=super.sample(a,at,px,pz,commit),c=this.current;
    if(!result||!c)return result;
    const weapon=a.weapon||'sword',attackProgress=a.attack?this.api.progress(a,at):null;
    const guardStrength=guardBlendStrength(a,attackProgress);
    const bodyStrength=readyBodyStrength(a,attackProgress);
    const handLocks=bodyStrength?this.captureHandLocks(c,weapon):null;
    this.applyReadyBody(c,bodyStrength,commit);
    if(guardStrength>1e-6){
      this.naturalizeHeldWeapon(c,weapon,handLocks,guardStrength);
      if(commit){
        this.syncVisibleArmSnapshot(c,weapon);
        c.vrm.update(0);
        c.root.updateMatrixWorld(true);
        for(const proxy of c.shadowMeshes){
          proxy.matrix.copy(proxy.userData.source.matrixWorld);
          proxy.matrixWorldNeedsUpdate=true;
        }
      }
    }else c.naturalStanceReport=null;
    return result;
  }

  report(){
    return {...super.report(),naturalStance:this.current?.naturalStanceReport??null,readyBodyStrength:this.current?.readyBodyStrength??0,readyBaseStrength:this.current?.readyBaseStrength??0};
  }
}
