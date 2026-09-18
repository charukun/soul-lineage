const COMBAT_PROP=/\b(?:arrow|axe|blade|bow|crossbow|dagger|mace|quiver|shield|spear|staff|sword|wand|weapon)\b/i;
export const REVIEW_BATTLE_EQUIPMENT=Object.freeze({
  'kaykit.rogue.v1':Object.freeze([{key:'dagger',asset:'dagger',bone:'rightHand',rotation:Object.freeze([0,0,-Math.PI/2]),scale:.72}]),
  'kaykit.rogue-hooded.v1':Object.freeze([{key:'dagger',asset:'dagger',bone:'rightHand',rotation:Object.freeze([0,0,-Math.PI/2]),scale:.72}]),
  'kaykit.knight.v1':Object.freeze([
    {key:'sword',asset:'sword_1handed',bone:'rightHand',rotation:Object.freeze([0,0,-Math.PI/2]),scale:.68},
    {key:'shield',asset:'shield_badge',bone:'leftHand',rotation:Object.freeze([Math.PI/2,0,0]),scale:.78}
  ])
});

export function isEmbeddedCombatPropName(value=''){return COMBAT_PROP.test(String(value).replace(/[_\-.]+/g,' '));}
export function hideEmbeddedCombatProps(root){
  let hidden=0;
  root?.traverse?.(node=>{
    if(!node?.isMesh)return;
    const materials=(Array.isArray(node.material)?node.material:[node.material]).filter(Boolean);
    const signature=[node.name,node.geometry?.name,...materials.map(material=>material?.name)].filter(Boolean).join(' ');
    if(isEmbeddedCombatPropName(signature)){node.visible=false;hidden++;}
  });
  return hidden;
}
export function reviewBattleEquipmentFor(modelId){return REVIEW_BATTLE_EQUIPMENT[modelId]||Object.freeze([]);}
