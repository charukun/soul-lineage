import * as T from '../vendor/three.js';
import {HumanoidRuntime as BaseHumanoidRuntime,weaponSockets} from './humanoid-core.js';

const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const Q=()=>new T.Quaternion();

function projectedDirection(vector,reach){
  const out=vector.clone().addScaledVector(reach,-vector.dot(reach));
  return out.lengthSq()>1e-10?out.normalize():out;
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
  const holding=(a.weaponDraw??1)>.25||a.combatReady||a.weaponTransition;
  const guardWindow=!a.attack||progress<=.12||progress>=.82;
  const quiet=guardWindow&&!a.reaction&&!a.recovery&&!a.dead&&!a.zanshin;
  return holding&&quiet&&(a.weapon||'sword')!=='fist';
}

export class HumanoidRuntime extends BaseHumanoidRuntime{
  naturalizeHeldWeapon(c,weapon){
    if(!c||weapon==='fist')return null;
    const spec=weaponSockets[weapon]||weaponSockets.sword;
    const sides=weapon==='sword'||spec.two?['right','left']:['right'];
    const metrics={weapon,sides:[],maxHandDisplacement:0,maxHandAngleError:0};
    c.root.updateMatrixWorld(true);
    for(const side of sides){
      if(!c.bones[side+'UpperArm']||!c.bones[side+'LowerArm']||!c.bones[side+'Hand'])continue;
      const handTarget=this.point(c,side+'Hand');
      const handQ=c.bones[side+'Hand'].getWorldQuaternion(Q());
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
    const spec=weaponSockets[weapon]||weaponSockets.sword;
    const sides=weapon==='sword'||spec.two?['right','left']:['right'];
    for(const side of sides)for(const bone of ['UpperArm','LowerArm','Hand']){
      const name=side+bone,current=c.bones[name],saved=c.lastActual[name];
      if(current&&saved){saved.q.copy(current.quaternion);saved.p.copy(current.position);}
    }
  }

  sample(a,at=null,px=a.x,pz=a.z,commit=false){
    const result=super.sample(a,at,px,pz,commit),c=this.current;
    if(!result||!c)return result;
    const attackProgress=a.attack?this.api.progress(a,at):null;
    if(shouldNaturalizeWeaponStance(a,attackProgress)){
      this.naturalizeHeldWeapon(c,a.weapon||'sword');
      if(commit){
        // super.sample() already committed the transition source. Replace just the
        // visible arm snapshot so the next state starts from the pose actually shown.
        this.syncVisibleArmSnapshot(c,a.weapon||'sword');
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
    return {...super.report(),naturalStance:this.current?.naturalStanceReport??null};
  }
}
