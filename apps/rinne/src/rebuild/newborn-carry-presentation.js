import {Quaternion,Vector3} from 'three';

const CARRIER_COMBAT_PROP_RE=/(?:weapon|sword|dagger|knife|axe|mace|hammer|spear|bow|crossbow|quiver|shield|staff|wand|orb|ball|sphere|potion|flask|bottle|lantern|torch|prop|item|tool|held|socket|holster)/i;

export const NEWBORN_CARRY=Object.freeze({
  pelvisForward:.14,
  pelvisSide:.025,
  pelvisLift:-.035,
  yawOffset:-.16,
  visualScale:.7,
  walkBob:.012,
  breathBob:.008
});

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));

export function newbornCarryTransform(position={x:0,z:0},yaw=0,{time=0,moving=false}={}){
  const facing=Number(yaw)||0,sin=Math.sin(facing),cos=Math.cos(facing);
  const bob=Math.sin((Number(time)||0)*1.45)*NEWBORN_CARRY.breathBob+(moving?Math.sin((Number(time)||0)*5.2)*NEWBORN_CARRY.walkBob:0);
  return Object.freeze({
    x:Number(position.x||0)+sin*NEWBORN_CARRY.pelvisForward+cos*NEWBORN_CARRY.pelvisSide,
    y:NEWBORN_CARRY.pelvisLift+bob,
    z:Number(position.z||0)+cos*NEWBORN_CARRY.pelvisForward-sin*NEWBORN_CARRY.pelvisSide,
    yaw:facing+NEWBORN_CARRY.yawOffset,
    pitch:0,
    roll:0,
    scale:NEWBORN_CARRY.visualScale
  });
}

function addRotation(bone,{x=0,y=0,z=0}={}){
  if(!bone?.rotation)return;
  bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;
}

/**
 * Adult cradle base pose. IK is applied after this pose so the two hands make
 * actual contact with the child's upper-back and pelvis support points.
 */
export function applyCarrierCradlePose(bones={},time=0,{moving=false}={}){
  const breathe=Math.sin((Number(time)||0)*1.35)*.016,walkRock=moving?Math.sin((Number(time)||0)*4.4)*.014:0;
  addRotation(bones.spine,{x:-.07+breathe,z:.025+walkRock});
  addRotation(bones.chest,{x:-.035+breathe*.5,z:.018});

  addRotation(bones.leftUpperArm,{x:-.7,y:.24,z:-.52});
  addRotation(bones.leftLowerArm,{x:-.96,y:-.38,z:-.08});
  addRotation(bones.leftHand,{x:-.16,y:-.1,z:-.08});

  addRotation(bones.rightUpperArm,{x:-.6,y:-.24,z:.42});
  addRotation(bones.rightLowerArm,{x:-1.08,y:.46,z:.12});
  addRotation(bones.rightHand,{x:-.18,y:.14,z:.06});

  addRotation(bones.neck,{x:.045,z:-.018});
  addRotation(bones.head,{x:.075,z:-.025});
}

/**
 * Newborn pose is authored around the pelvis, not by rolling the whole actor root.
 * Rotating the actor root rolled around the feet-origin and was the reason the body
 * read as a horizontal prop in the previous implementation.
 */
export function applyNewbornCradlePose(bones={},time=0){
  const breathe=Math.sin((Number(time)||0)*1.7)*.018;
  addRotation(bones.hips,{x:.08,y:-.08,z:-1.18});
  addRotation(bones.spine,{x:.22+breathe,y:.05,z:-.08});
  addRotation(bones.chest,{x:.12+breathe*.6,z:-.04});
  addRotation(bones.neck,{x:-.08,z:.05});
  addRotation(bones.head,{x:-.14,z:.08});

  addRotation(bones.leftUpperLeg,{x:.92,y:-.16,z:.16});
  addRotation(bones.rightUpperLeg,{x:.78,y:.2,z:-.12});
  addRotation(bones.leftLowerLeg,{x:-1.22,z:-.1});
  addRotation(bones.rightLowerLeg,{x:-1.08,z:.08});

  addRotation(bones.leftUpperArm,{x:-.5,y:.18,z:-.3});
  addRotation(bones.rightUpperArm,{x:-.42,y:-.18,z:.26});
  addRotation(bones.leftLowerArm,{x:-.82,y:-.22,z:-.1});
  addRotation(bones.rightLowerArm,{x:-.76,y:.24,z:.1});
}

function worldPosition(node,target){
  if(!node?.getWorldPosition)return null;
  node.updateWorldMatrix?.(true,false);
  return node.getWorldPosition(target);
}

function aimJointAt(joint,end,target,strength=.88){
  if(!joint?.parent||!end||!target)return false;
  joint.updateWorldMatrix?.(true,false);end.updateWorldMatrix?.(true,false);
  const jointPos=worldPosition(joint,new Vector3()),endPos=worldPosition(end,new Vector3());
  if(!jointPos||!endPos)return false;
  const current=endPos.sub(jointPos),desired=target.clone().sub(jointPos);
  if(current.lengthSq()<1e-8||desired.lengthSq()<1e-8)return false;
  current.normalize();desired.normalize();
  const delta=new Quaternion().setFromUnitVectors(current,desired),partial=new Quaternion().identity().slerp(delta,clamp01(strength));
  const jointWorld=new Quaternion(),parentWorld=new Quaternion();
  joint.getWorldQuaternion(jointWorld);joint.parent.getWorldQuaternion(parentWorld).invert();
  joint.quaternion.copy(parentWorld.multiply(partial.multiply(jointWorld))).normalize();
  joint.updateWorldMatrix?.(true,true);
  return true;
}

function solveHand(upper,lower,hand,target){
  if(!upper||!lower||!hand||!target)return Infinity;
  for(let i=0;i<3;i++){
    aimJointAt(lower,hand,target,.74);
    aimJointAt(upper,hand,target,.9);
  }
  const handPosition=worldPosition(hand,new Vector3());
  return handPosition?handPosition.distanceTo(target):Infinity;
}

export function cradleSupportTargets(childBones={}){
  const spine=worldPosition(childBones.spine,new Vector3()),head=worldPosition(childBones.head,new Vector3()),hips=worldPosition(childBones.hips,new Vector3());
  if(!spine||!head||!hips)return null;
  const leftLeg=worldPosition(childBones.leftUpperLeg,new Vector3()),rightLeg=worldPosition(childBones.rightUpperLeg,new Vector3());
  const upper=spine.clone().lerp(head,.3);upper.y-=.025;
  const lower=hips.clone();
  if(leftLeg&&rightLeg)lower.lerp(leftLeg.clone().add(rightLeg).multiplyScalar(.5),.22);
  lower.y-=.035;
  return{upper,lower};
}

/** Keep the child's pelvis bound to the carrier torso so walk/breath motion stays one coupled silhouette. */
export function positionNewbornForCradle({carrierRoot,carrierBones={},childRoot,childBones={},time=0,moving=false}={}){
  if(!carrierRoot||!childRoot||!childBones.hips)return null;
  carrierRoot.updateMatrixWorld?.(true);
  childRoot.updateMatrixWorld?.(true);
  const carrierAnchor=carrierBones.chest||carrierBones.spine;
  const anchor=worldPosition(carrierAnchor,new Vector3())||carrierRoot.getWorldPosition(new Vector3());
  const rootWorld=new Quaternion();carrierRoot.getWorldQuaternion(rootWorld);
  const forward=new Vector3(0,0,1).applyQuaternion(rootWorld).normalize(),right=new Vector3(1,0,0).applyQuaternion(rootWorld).normalize();
  const bob=Math.sin((Number(time)||0)*1.45)*NEWBORN_CARRY.breathBob+(moving?Math.sin((Number(time)||0)*5.2)*NEWBORN_CARRY.walkBob:0);
  anchor.addScaledVector(forward,NEWBORN_CARRY.pelvisForward).addScaledVector(right,NEWBORN_CARRY.pelvisSide);anchor.y+=NEWBORN_CARRY.pelvisLift+bob;

  const hips=worldPosition(childBones.hips,new Vector3());
  if(!hips)return null;
  if(childRoot.parent?.worldToLocal){
    childRoot.parent.updateMatrixWorld?.(true);
    const targetLocal=childRoot.parent.worldToLocal(anchor.clone()),hipsLocal=childRoot.parent.worldToLocal(hips.clone());
    childRoot.position.add(targetLocal.sub(hipsLocal));
  }else childRoot.position.add(anchor.clone().sub(hips));
  childRoot.updateMatrixWorld?.(true);
  return Object.freeze({x:anchor.x,y:anchor.y,z:anchor.z});
}

/** Two-chain contact solve: left hand supports upper back/neck, right hand supports pelvis/thighs. */
export function solveCarrierCradleContacts(carrierBones={},childBones={}){
  const targets=cradleSupportTargets(childBones);
  if(!targets)return Object.freeze({upperError:Infinity,lowerError:Infinity,solved:false});
  const upperError=solveHand(carrierBones.leftUpperArm,carrierBones.leftLowerArm,carrierBones.leftHand,targets.upper);
  const lowerError=solveHand(carrierBones.rightUpperArm,carrierBones.rightLowerArm,carrierBones.rightHand,targets.lower);
  return Object.freeze({upperError,lowerError,solved:Number.isFinite(upperError)&&Number.isFinite(lowerError)});
}

export function isCarrierCombatPropName(name=''){
  return CARRIER_COMBAT_PROP_RE.test(String(name));
}

/** Carrier-only visual sanitization. It never mutates gameplay equipment state. */
export function hideCarrierCombatProps(root){
  if(!root?.traverse)return 0;
  let hidden=0;
  root.traverse(node=>{
    if(!node?.name||!isCarrierCombatPropName(node.name))return;
    if(node.isBone)return;
    node.visible=false;hidden+=1;
  });
  return hidden;
}

/**
 * Birth carry must never show a free hand-held object. Character pools keep
 * detached weapon/socket visuals outside the skinned body, so suppress both
 * those attachment roots and any embedded named prop meshes while carrying.
 */
export function sanitizeCarrierCarryVisual(root,{attachments=null,active=true}={}){
  if(attachments)attachments.visible=!active;
  if(!active)return 0;
  const hidden=hideCarrierCombatProps(root);
  if(root?.userData)root.userData.carryPropSanitized=true;
  return hidden;
}
