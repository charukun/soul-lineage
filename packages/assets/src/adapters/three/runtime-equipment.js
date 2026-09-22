// The existing RINNE weapon geometry, shared by the 3D hero and Character25D.
// Calibration uses the existing @soul/animations weaponCalibration field names.
const profile=(id,tip,{grip=[0,.03,0],supportGrip=grip,scale=.72,twoHanded=false,category='blade',carry='side'}={})=>Object.freeze({
  version:1,id:`rinne.${id}.v1`,grip:Object.freeze(grip),supportGrip:Object.freeze(supportGrip),
  rotation:Object.freeze([0,0,0,1]),supportRotation:Object.freeze([0,0,0,1]),scale,twoHanded,
  bladeBase:Object.freeze([0,.18,0]),bladeTip:Object.freeze([0,tip,0]),
  presentationCategory:category,occlusionMode:'socket-depth',defaultCarryPose:carry,
});
export const RINNE_EQUIPMENT_PROFILES=Object.freeze({
  dagger:profile('dagger',.66),sword:profile('sword',1.08),
  great:profile('great',1.43,{grip:[0,.09,0],supportGrip:[0,-.09,0],twoHanded:true,carry:'two-hand'}),
  spear:profile('spear',1.88,{grip:[0,.62,0],supportGrip:[0,.28,0],twoHanded:true,category:'polearm',carry:'two-hand'}),
  axe:profile('axe',1.2,{category:'axe'}),staff:profile('staff',1.68,{category:'staff'}),
  shield:profile('shield',.34,{grip:[0,0,-.055],scale:.8,category:'shield',carry:'guard'}),
});
export function resolveRinneEquipment(equipment={}){
  const weapon=Object.hasOwn(RINNE_EQUIPMENT_PROFILES,equipment.weapon)&&equipment.weapon!=='shield'?equipment.weapon:null;
  return {weapon,shield:Boolean(equipment.shield)&&!RINNE_EQUIPMENT_PROFILES[weapon]?.twoHanded};
}
export function createRinneWeapon(THREE,id,mini=false){
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.08,...extra});
  const box=(parent,size,pos,color)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat(color));mesh.position.set(...pos);parent.add(mesh);return mesh;};
  const cyl=(parent,r,h,pos,color,segments=10)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat(color));mesh.position.set(...pos);parent.add(mesh);return mesh;};
  const blade=(parent,length=.9,width=.09)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,length,.055),mat(0xd8d8cf,{metalness:.6,roughness:.3}));mesh.position.y=length/2+.18;parent.add(mesh);box(parent,[.34,.055,.09],[0,.18,0],0x8c724a);cyl(parent,.045,.3,[0,.03,0],0x5d4532,8);};
  const g=new THREE.Group();g.name=`RinneEquipment:${id}`;g.userData.assetId=`rinne.equipment.${id}`;
  if(id==='fist'){cyl(g,.08,.28,[0,.18,0],0x8a7050,8);box(g,[.28,.08,.12],[0,.34,0],0xb69a72);}
  else if(id==='dagger')blade(g,.48,.105);
  else if(id==='sword')blade(g,.9,.09);
  else if(id==='great'){blade(g,1.25,.16);g.scale.x=1.12;}
  else if(id==='spear'){cyl(g,.035,1.55,[0,.78,0],0x775b42,8);const tip=new THREE.Mesh(new THREE.ConeGeometry(.105,.32,6),mat(0xd8d8cf,{metalness:.6,roughness:.3}));tip.position.y=1.72;g.add(tip);}
  else if(id==='axe'){cyl(g,.045,1.15,[0,.58,0],0x775b42,8);box(g,[.38,.34,.08],[.15,1.03,0],0xbfc0b5);}
  else if(id==='staff'){cyl(g,.05,1.5,[0,.75,0],0x72523e,10);const orb=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),mat(0x8aa8a3,{emissive:0x304947,emissiveIntensity:.6}));orb.position.y=1.55;g.add(orb);}
  else if(id==='shield'){const shield=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.07,18),mat(0x78919c,{metalness:.35,roughness:.48}));shield.rotation.x=Math.PI/2;g.add(shield);}
  else throw new Error(`Unknown RINNE equipment: ${id}`);
  // Retain the original runtime dimensions (including the original greatsword scale).
  g.scale.setScalar(mini?.58:1);return g;
}
export function disposeRinneEquipment(root){root?.removeFromParent();root?.traverse(node=>{node.geometry?.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])material?.dispose();});}
