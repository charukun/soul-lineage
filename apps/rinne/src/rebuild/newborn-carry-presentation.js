const CARRIER_COMBAT_PROP_RE=/(?:weapon|sword|dagger|knife|axe|mace|hammer|spear|bow|crossbow|quiver|shield|staff|wand)/i;

/**
 * Cradle carry anchor. The newborn stays high and close to the carrier's torso so the
 * silhouettes overlap as one supported pose instead of reading as a floating body.
 */
export const NEWBORN_CARRY=Object.freeze({
  forward:.27,
  side:.035,
  height:1.08,
  yawOffset:-.08,
  pitch:-.16,
  roll:-Math.PI/2+.08
});

export function newbornCarryTransform(position={x:0,z:0},yaw=0){
  const facing=Number(yaw)||0,sin=Math.sin(facing),cos=Math.cos(facing);
  return Object.freeze({
    x:Number(position.x||0)+sin*NEWBORN_CARRY.forward+cos*NEWBORN_CARRY.side,
    y:NEWBORN_CARRY.height,
    z:Number(position.z||0)+cos*NEWBORN_CARRY.forward-sin*NEWBORN_CARRY.side,
    yaw:facing+NEWBORN_CARRY.yawOffset,
    pitch:NEWBORN_CARRY.pitch,
    roll:NEWBORN_CARRY.roll
  });
}

function addRotation(bone,{x=0,y=0,z=0}={}){
  if(!bone?.rotation)return;
  bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;
}

/** Adult asymmetric cradle pose: one arm supports shoulders/back, the other supports hips. */
export function applyCarrierCradlePose(bones={},time=0,{moving=false}={}){
  const breathe=Math.sin((Number(time)||0)*1.35)*.018,walkRock=moving?Math.sin((Number(time)||0)*4.2)*.018:0;
  addRotation(bones.spine,{x:-.055+breathe,z:.025+walkRock});
  addRotation(bones.chest,{x:-.025+breathe*.5,z:.018});

  addRotation(bones.leftUpperArm,{x:-.74,y:.18,z:-.48});
  addRotation(bones.leftLowerArm,{x:-.88,y:-.34,z:-.08});
  addRotation(bones.leftHand,{x:-.18,y:-.12,z:-.06});

  addRotation(bones.rightUpperArm,{x:-.62,y:-.22,z:.39});
  addRotation(bones.rightLowerArm,{x:-1.02,y:.42,z:.1});
  addRotation(bones.rightHand,{x:-.2,y:.16,z:.05});

  addRotation(bones.neck,{x:.035,z:-.018});
  addRotation(bones.head,{x:.055,z:-.025});
}

/** Newborn curled pose so the carried body has bent hips/knees and relaxed arms. */
export function applyNewbornCradlePose(bones={},time=0){
  const breathe=Math.sin((Number(time)||0)*1.7)*.02;
  addRotation(bones.spine,{x:.12+breathe});
  addRotation(bones.chest,{x:.08+breathe*.6});
  addRotation(bones.neck,{x:-.06,z:.04});
  addRotation(bones.head,{x:-.09,z:.06});

  addRotation(bones.leftUpperLeg,{x:.72,y:-.08,z:.08});
  addRotation(bones.rightUpperLeg,{x:.62,y:.12,z:-.06});
  addRotation(bones.leftLowerLeg,{x:-1.02,z:-.05});
  addRotation(bones.rightLowerLeg,{x:-.9,z:.06});

  addRotation(bones.leftUpperArm,{x:-.46,y:.12,z:-.24});
  addRotation(bones.rightUpperArm,{x:-.38,y:-.16,z:.2});
  addRotation(bones.leftLowerArm,{x:-.72,y:-.18,z:-.08});
  addRotation(bones.rightLowerArm,{x:-.66,y:.2,z:.08});
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
