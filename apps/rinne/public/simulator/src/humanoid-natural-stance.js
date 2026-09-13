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

export function shouldNaturalizeWeaponStance(a,progress=null){
  // weaponTransition spans the whole draw/sheathe animation, including frames where
  // the weapon is still in the scabbard. Correct only once the weapon is visibly held.
  const holding=(a.weaponDraw??1)>.25;
  const guardWindow=!a.attack||progress<=.12||progress>=.82;
  const quiet=guardWindow&&!a.reaction&&!a.recovery&&!a.dead&&!a.zanshin;
  return holding&&quiet&&(a.weapon||'sword')!=='fist';
}

/** Small whole-body support for the ready silhouette. The same support fades out over
 * the opening guard and returns over the authored recovery, so attack->guard never
 * switches the shoulders underneath a world-locked wrist in one frame. */
export function readyBodyStrength(a,progress=null){
  if(!a||a.reaction||a.recovery||a.dead||a.zanshin)return 0;
  if(!(a.combatReady||a.weaponTransition)||(a.weapon||'sword')==='fist')return 0;
  if(Math.hypot(a.vx||0,a.vz||0)>.10)return 0;
  const draw=smooth(((a.weaponDraw??1)-.25)/.75);
  if(!a.attack)return draw;
  if(!Number.isFinite(progress))return 0;
  if(progress<=.12)return draw*(1-smooth(progress/.12));
  if(progress>=.82)return draw*smooth((progress-.82)/.18);
  return 0;
}

export class HumanoidRuntime extends BaseHumanoidRuntime{
  captureHandLocks(c,weapon){
    c.root.updateMatrixWorld(true);
    return Object.fromEntries(stanceSides(weapon).filter(side=>c.bones[side+'Hand']).map(side=>[side,{
      position:this.point(c,side+'Hand'),
      quaternion:c.bones[side+'Hand'].getWorldQuaternion(Q())
    }]));
  }

  applyReadyBody(c,strength,commit=false){
    strength=clamp(strength);
    c.readyBodyStrength=strength;
    if(!strength)return;
    const flip=c.vrm.meta.metaVersion==='1'?-1:1;
    const deltas={
      spine:new T.Euler(-.030*flip*strength,0,0,'YXZ'),
      chest:new T.Euler(-.010*flip*strength,0,0,'YXZ'),
      neck:new T.Euler(.012*flip*strength,0,0,'YXZ'),
      head:new T.Euler(.020*flip*strength,0,0,'YXZ')
    };
    for(const [name,euler]of Object.entries(deltas)){
      const bone=c.bones[name];if(!bone)continue;
      const delta=Q().setFromEuler(euler);
      bone.quaternion.multiply(delta).normalize();
      // super.sample() captured the transition source before this presentation layer.
      // Carry the same small support posture into that snapshot so the next state does
      // not briefly return to the idle torso. Positions/pelvis/feet stay untouched.
      if(commit&&c.lastActual?.[name])c.lastActual[name].q.multiply(delta).normalize();
    }
    c.root.updateMatrixWorld(true);
  }

  naturalizeHeldWeapon(c,weapon,locks=null){
    if(!c||weapon==='fist')return null;
    const sides=stanceSides(weapon);
    const metrics={weapon,sides:[],maxHandDisplacement:0,maxHandAngleError:0};
    c.root.updateMatrixWorld(true);
    for(const side of sides){
      if(!c.bones[side+'UpperArm']||!c.bones[side+'LowerArm']||!c.bones[side+'Hand'])continue;
      const lock=locks?.[side],handTarget=lock?.position?.clone()??this.point(c,side+'Hand');
      const handQ=lock?.quaternion?.clone()??c.bones[side+'Hand'].getWorldQuaternion(Q());
      const pole=naturalArmPole(this,c,side);
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
    const bodyStrength=readyBodyStrength(a,attackProgress);
    // Save the already-authored hand/weapon contact before the torso begins supporting
    // it. Re-solving the arms back to these world transforms keeps result.sm, collision
    // sampling and the visible grip coincident even though the shoulders move slightly.
    const handLocks=bodyStrength?this.captureHandLocks(c,weapon):null;
    this.applyReadyBody(c,bodyStrength,commit);
    if(shouldNaturalizeWeaponStance(a,attackProgress)){
      this.naturalizeHeldWeapon(c,weapon,handLocks);
      if(commit){
        // super.sample() already committed the transition source. Replace just the
        // visible arm snapshot so the next state starts from the pose actually shown.
        this.syncVisibleArmSnapshot(c,weapon);
        // Naturalized normalized bones must reach the rendered/raw skeleton in this
        // same frame. Weapon/socket matrices stay valid because hand position and
        // world orientation are deliberately preserved by naturalizeHeldWeapon().
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
    return {...super.report(),naturalStance:this.current?.naturalStanceReport??null,readyBodyStrength:this.current?.readyBodyStrength??0};
  }
}
