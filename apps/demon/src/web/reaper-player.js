import * as T from 'three';
import {createShinoProductionPool} from '@soul/rendering/master-character-production';
import {loadDemonMasterModel} from '../master-model.js';
import {dressReaper} from './reaper-wardrobe.js';
import {sampleDevourMotion} from './devour-motion.js';

const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const appearance=Object.freeze({scale:1,headScale:1,height:1,width:.92,gray:0,stoop:0,skinAge:0,adultHeightMetres:1.98,
  canEquipWeapon:true,dead:false,skin:[1,.96,.99],hair:[.82,.84,.94],eyes:[.58,.35,.84],dye:[.025,.020,.035]});

// The combat engine supplies hands and weapon tip in the existing actor frame.
// Solve both arm chains into that frame instead of inventing another attack clock.
function aim(bone,child,target) {
  bone.updateWorldMatrix(true,true);
  const origin=bone.getWorldPosition(new T.Vector3()),from=child.getWorldPosition(new T.Vector3()).sub(origin),to=target.clone().sub(origin);
  if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;
  const world=bone.getWorldQuaternion(new T.Quaternion());
  const parent=bone.parent.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize())).multiply(world));
  bone.updateWorldMatrix(false,true);
}
function armIK(actor,group,side,handTarget) {
  const upper=actor.bones[side+'UpperArm'],lower=actor.bones[side+'LowerArm'],hand=actor.bones[side+'Hand'];
  group.updateWorldMatrix(true,true);
  const shoulder=upper.getWorldPosition(new T.Vector3()),elbow=lower.getWorldPosition(new T.Vector3()),wrist=hand.getWorldPosition(new T.Vector3());
  const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),target=group.localToWorld(new T.Vector3(...handTarget));
  const axis=target.clone().sub(shoulder),distance=clamp(axis.length(),Math.abs(a-b)+.001,a+b-.001);axis.normalize();
  target.copy(shoulder).addScaledVector(axis,distance);
  const hint=group.localToWorld(new T.Vector3(side==='left'?.7:-.7,.8,-.4)).sub(shoulder);
  hint.addScaledVector(axis,-hint.dot(axis));if(hint.lengthSq()<1e-8)hint.set(0,0,1);hint.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(hint,height);
  aim(upper,lower,elbow);aim(lower,hand,target);
}

export function createReaperPlayer({gltf,rig}) {
  const pool=createShinoProductionPool({template:gltf.scene,humanoid:rig.humanoid,rig,capacity:1});
  const actor=pool.spawn('demon.silver-reaper'),root=new T.Group();root.name='demon-silver-reaper';root.add(actor.root);
  const wardrobe=dressReaper(actor);root.add(wardrobe.scythe);
  const rotation=new T.Quaternion(),hand=new T.Vector3(),direction=new T.Vector3(),neutral=new T.Vector3(.22,.97,.12).normalize();
  let previousYaw=null;
  function update(player,time,dt,{eating=false,preview=false,dead=false}={}) {
    const q=preview?null:player.pose,moving=!q&&!preview&&(player.speed||0)>.05;
    const phase=player.walk||0,stride=moving?Math.sin(phase)*.38:0;
    const devour=eating&&Number.isFinite(player.devourProgress)?sampleDevourMotion(player.devourProgress):null;
    root.position.set(player.x,0,player.z);root.rotation.set(0,player.yaw||0,0);
    actor.sample({...appearance,dead},Math.max(0,time),bones=>{
      const turn=(bone,axis,value)=>bone.quaternion.multiply(rotation.setFromAxisAngle(axis,value));
      turn(bones.leftUpperLeg,X,stride);turn(bones.rightUpperLeg,X,-stride);
      turn(bones.leftLowerLeg,X,Math.max(0,-stride)*1.2);turn(bones.rightLowerLeg,X,Math.max(0,stride)*1.2);
      turn(bones.spine,X,clamp(devour?devour.pitch*.65:q?.pitch||0,-.65,.8));
      turn(bones.spine,Y,clamp(devour?devour.twist:q?.twist||0,-1.1,1.1));
      turn(bones.spine,Z,clamp(q?.roll||0,-.45,.45));
      if(!devour)for(const finger of ['Index','Middle','Ring','Little'])for(const joint of ['Proximal','Intermediate','Distal']){const b=bones['left'+finger+joint];if(b)turn(b,Z,joint==='Proximal'?-.65:-.8);}
      turn(bones.head,X,devour?devour.headPitch*.5:-.04);
      turn(bones.head,Y,devour?devour.headYaw:Math.sin(time*.6)*.035);
      bones.hips.position.y+=(q?.crouch||0)*.18+(q?.lift||0)*.5+(moving?Math.abs(Math.sin(phase))*.012:Math.sin(time*1.5)*.004);
      if(devour){bones.hips.position.y+=devour.drop*.28;turn(bones.leftUpperLeg,X,-.2);turn(bones.rightUpperLeg,X,-.2);turn(bones.leftLowerLeg,X,.35);turn(bones.rightLowerLeg,X,.35);}
    });
    const right=devour?[.32,devour.handY,devour.handZ]:q?.hand||[.43,1.02,.14];
    const left=devour?[-.32,devour.handY+.04,devour.handZ]:q?.left||[-.33,1.08,.12-Math.sin(phase)*Number(moving)*.15];
    // Legacy +X weapon hand maps to the raw VRM left-side chain.
    armIK(actor,root,'left',right);armIK(actor,root,'right',left);
    if(actor.expressionNames.includes('blink')){const blink=time%4;actor.setExpression('blink',blink<.15?Math.sin(blink/.15*Math.PI):0);}
    if(actor.expressionNames.includes('aa'))actor.setExpression('aa',devour?clamp(-devour.jaw*.65,0,.7):0);
    const yaw=player.yaw||0,yawDelta=previousYaw===null?0:Math.atan2(Math.sin(yaw-previousYaw),Math.cos(yaw-previousYaw));previousYaw=yaw;
    wardrobe.hair.rotation.set(.03+Number(moving)*.10+Math.sin(time*1.8)*.022,clamp(-yawDelta*3,-.3,.3),Math.sin(time*1.1)*.025);
    wardrobe.skirt.rotation.set(Number(moving)*.018,clamp(-yawDelta*1.8,-.1,.1),Math.sin(phase*2)*Number(moving)*.025);
    root.updateWorldMatrix(true,true);
    root.worldToLocal(actor.bones.leftHand.getWorldPosition(hand));wardrobe.scythe.position.copy(hand);
    if(q?.tip){direction.set(q.tip[0]-q.hand[0],q.tip[1]-q.hand[1],q.tip[2]-q.hand[2]);if(direction.lengthSq()<1e-8)direction.copy(neutral);direction.normalize();}
    else direction.copy(neutral);
    wardrobe.scythe.quaternion.setFromUnitVectors(Y,direction);
    wardrobe.scythe.visible=!dead&&!devour;
    if(dead){root.rotation.z=1.35;root.position.y=.14;}
    // Pose-controlled hair replaces source spring meshes. No redundant spring solve.
    root.updateWorldMatrix(true,true);
  }
  return {root,actor,wardrobe,update,dispose(){wardrobe.dispose();pool.dispose();root.removeFromParent();}};
}

export async function loadReaperPlayer(){return createReaperPlayer(await loadDemonMasterModel());}
