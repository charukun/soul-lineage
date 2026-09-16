const CARRIER_COMBAT_PROP_RE=/(?:weapon|sword|dagger|knife|axe|mace|hammer|spear|bow|crossbow|quiver|shield|staff|wand)/i;

export const NEWBORN_CARRY=Object.freeze({forward:.43,side:.11,height:.94,roll:-Math.PI/2});

export function newbornCarryTransform(position={x:0,z:0},yaw=0){
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  return Object.freeze({
    x:Number(position.x||0)+sin*NEWBORN_CARRY.forward+cos*NEWBORN_CARRY.side,
    y:NEWBORN_CARRY.height,
    z:Number(position.z||0)+cos*NEWBORN_CARRY.forward-sin*NEWBORN_CARRY.side,
    yaw:Number(yaw)||0,
    roll:NEWBORN_CARRY.roll
  });
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
