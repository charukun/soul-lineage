import { Color, DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { validateVisualIdentity } from '@soul/characters';
import { attachFaceIdentity } from './master-character-face.js';
import { leaseWardrobeGeometry, wardrobeCacheStats, hairGeometry, outfitGeometry, gearGeometry, accessoryGeometry } from './master-character-wardrobe.js';

const KEY = Symbol('master-character-modular');
const BASE = Object.freeze({ version: 1, face: 'classic', hair: 'original', body: 'balanced', outfit: 'uniform', accessory: 'none' });
const values = Object.freeze({ face: ['classic','round','sharp','long'], hair: ['original','bob','crop','tail'],
  body: ['balanced','slender','sturdy','compact'], outfit: ['uniform','tunic','mantle','apron'], accessory: ['none','glasses','headband','scarf'] });
const FACE = { classic:[1,1,1], round:[1.08,.96,1.05], sharp:[.94,1.04,.96], long:[.96,1.08,.97] };
const BODY = { balanced:[1,1,1], slender:[.9,1.02,.92], sturdy:[1.1,.98,1.08], compact:[1.04,.94,1.03] };
const check = (ok, message) => { if (!ok) throw new Error(message); };
const grayHair = new Color(.65,.65,.62);
function canonicalProfile(input) {
  check(input && typeof input === 'object' && (input.version === undefined || input.version === 1), 'Invalid modular appearance version');
  const result = { ...BASE, ...input, version: 1 };
  check(Object.keys(result).every(k => k === 'version' || Object.hasOwn(values,k)), 'Invalid modular appearance field');
  for (const [slot, allowed] of Object.entries(values)) check(allowed.includes(result[slot]), `Invalid modular appearance ${slot}`);
  return Object.freeze(result);
}
function group(parent,name) { const g=new Group();g.name=name;parent.add(g);return g; }

/** Extension of the existing pool: source geometry/textures/rig and the complete base
 * outfit remain loader-owned. Each actor owns only material uniforms and part leases.
 * Restoring the source Shino does not change saved genes, expressions or motion clips.
 */
export function attachModularAppearanceController(actor) {
  check(actor?.root?.isObject3D && actor.visual?.isObject3D && actor.bones?.head && actor.bones?.spine, 'Invalid modular appearance actor');
  if (actor[KEY]) return actor[KEY];
  let profile=BASE, identity=null, appearance=null, destroyed=false;
  const sourceHair = new Map();
  actor.visual.traverse(n=>{if(!n.isMesh)return;for(const m of Array.isArray(n.material)?n.material:[n.material])if(m&&/HAIR/i.test(m.name))sourceHair.set(m,m.visible);});
  const roots={ hair:group(actor.bones.head,'mc-hair-root'), outfit:group(actor.bones.spine,'mc-outfit-root'),
    headAccessory:group(actor.bones.head,'mc-head-accessory'), torsoAccessory:group(actor.bones.spine,'mc-torso-accessory'), gear:group(actor.bones.spine,'mc-role-gear') };
  const groups={};
  for(const slot of ['hair','outfit'])for(const id of values[slot].slice(1))groups[`${slot}:${id}`]=group(roots[slot],`${slot}:${id}`);
  for(const id of values.accessory.slice(1))groups[`accessory:${id}`]=group(id==='scarf'?roots.torsoAccessory:roots.headAccessory,`accessory:${id}`);
  const materials={
    hair:new MeshStandardMaterial({name:'MC_COIFFURE',color:0x473122,roughness:.67}),
    cloth:new MeshStandardMaterial({name:'MC_CLOTH',color:0x647b69,roughness:.91,side:DoubleSide}),
    trim:new MeshStandardMaterial({name:'MC_ACCENT',color:0x98835f,roughness:.84,side:DoubleSide}),
    dark:new MeshStandardMaterial({name:'MC_DARK',color:0x382d25,roughness:.77}),
    metal:new MeshStandardMaterial({name:'MC_METAL',color:0x7f8c8b,roughness:.56,metalness:.32,side:DoubleSide})
  };
  const shapeScratch=new Vector3(),dyeScratch=new Color();
  const slots=new Map(), facial=attachFaceIdentity(actor), baseRoot=actor.root.scale.clone(), baseHead=actor.bones.head.scale.clone(), baseline=new Map();
  const adjusted=['hips','leftShoulder','rightShoulder','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'];
  function capture() { baseRoot.copy(actor.root.scale);baseHead.copy(actor.bones.head.scale);
    for(const name of adjusted)if(actor.bones[name]){let p=baseline.get(name);if(!p){p=new Vector3();baseline.set(name,p);}p.copy(actor.bones[name].position);} }
  capture();
  function clearSlot(slot) {const entry=slots.get(slot);if(entry){entry.mesh.removeFromParent();entry.lease.release();slots.delete(slot);}}
  function part(slot,key,parent,material,factory) {
    const existing=slots.get(slot);if(existing?.key===key)return;
    clearSlot(slot);if(!key)return;
    const lease=leaseWardrobeGeometry(key,factory),mesh=new Mesh(lease.geometry,material);
    mesh.name=`mc-part:${key}`;mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);slots.set(slot,{key,lease,mesh});
  }
  function buildParts() {
    for(const [name,g] of Object.entries(groups)) {const [slot,id]=name.split(':');g.visible=profile[slot]===id;}
    const front=identity?.front??'parted',back=identity?.back??'close';
    part('hair',profile.hair==='original'?null:`hair-v2:${profile.hair}:${front}:${back}`,groups[`hair:${profile.hair}`],materials.hair,()=>hairGeometry(profile.hair,front,back));
    for(const trim of [false,true])part(`outfit:${trim}`,profile.outfit==='uniform'?null:`outfit-v2:${profile.outfit}:${trim}`,groups[`outfit:${profile.outfit}`],trim?materials.trim:materials.cloth,()=>outfitGeometry(profile.outfit,trim));
    part('accessory',profile.accessory==='none'?null:`accessory-v2:${profile.accessory}`,groups[`accessory:${profile.accessory}`],profile.accessory==='scarf'?materials.cloth:materials.dark,()=>accessoryGeometry(profile.accessory));
    const gear=identity&&profile.outfit!=='uniform'?identity.gear:'none';
    for(const metal of [false,true]){
      const hasGeometry=gear!=='none'&&(metal?['pauldron','armor','tools','quiver','pack','satchel','cowl','shawl','stole','chain'].includes(gear):gear!=='chain');
      part(`gear:${metal}`,hasGeometry?`gear-v1:${gear}:${metal}`:null,roots.gear,metal?materials.metal:materials.trim,()=>gearGeometry(gear,metal));
    }
  }
  function apply() {
    if(destroyed)return;
    actor.root.scale.copy(baseRoot).multiply(shapeScratch.fromArray(BODY[profile.body]));
    actor.bones.head.scale.copy(baseHead).multiply(shapeScratch.fromArray(FACE[profile.face]));
    for(const [name,position] of baseline)actor.bones[name].position.copy(position);
    if(identity){
      const p=identity.proportions;
      actor.bones.head.scale.multiplyScalar(p.head);
      for(const side of ['left','right']){
        for(const name of ['Shoulder','UpperArm'])if(actor.bones[side+name])actor.bones[side+name].position.x*=p.shoulders;
        for(const name of ['LowerArm','Hand'])if(actor.bones[side+name])actor.bones[side+name].position.multiplyScalar(p.arms);
        for(const name of ['LowerLeg','Foot'])if(actor.bones[side+name])actor.bones[side+name].position.multiplyScalar(p.legs);
      }
      // Move the hip by the same leg-length delta, keeping the neutral feet grounded.
      if(baseline.has('leftLowerLeg')&&baseline.has('leftFoot'))actor.bones.hips.position.y+=(Math.abs(baseline.get('leftLowerLeg').y)+Math.abs(baseline.get('leftFoot').y))*(p.legs-1);
    }
    for(const [material,visible] of sourceHair)material.visible=visible&&profile.hair==='original';
    if(appearance){
      materials.hair.color.setRGB(...appearance.hair).multiplyScalar(identity?.hairValue??1).lerp(grayHair,appearance.gray??0);
      materials.cloth.color.setRGB(...(identity?.cloth??[.52,.63,.55])).multiply(dyeScratch.setRGB(...appearance.dye));
      materials.trim.color.setRGB(...(identity?.trim??[.67,.55,.36]));
      if(profile.accessory==='headband')materials.dark.color.copy(materials.trim.color);else materials.dark.color.setRGB(.10,.085,.07);
      // Base sleeve/stocking textures remain part of the original complete outfit.
    }
    facial.set(identity,appearance);
    actor.updateAttachments?.();
  }
  const sample=actor.sample.bind(actor),reset=actor.reset.bind(actor),destroy=actor.destroy.bind(actor);
  const controller={
    get profile(){return {...profile};}, get identity(){return identity;}, get usesSourceHair(){return profile.hair==='original';},
    setProfile(next){profile=canonicalProfile(next);buildParts();actor.resetSecondary?.();apply();return controller.profile;},
    setIdentity(next){
      if(next!==null){validateVisualIdentity(next);identity=JSON.parse(JSON.stringify(next));profile=canonicalProfile(identity.parts);}else identity=null;
      buildParts();actor.resetSecondary?.();apply();
    },
    apply,
    diagnostics(){return{...profile,identityVersion:identity?.version??null,role:identity?.role??null,front:identity?.front??null,back:identity?.back??null,
      sourceHairMaterials:sourceHair.size,faceMaterials:facial.materialCount,activePartMeshes:slots.size,shared:wardrobeCacheStats()};}
  };
  actor.sample=(p,...args)=>{sample(p,...args);appearance=p;capture();apply();};
  actor.reset=()=>{profile=BASE;identity=null;appearance=null;reset();capture();buildParts();apply();};
  actor.destroy=()=>{if(destroyed)return;actor.reset();for(const key of [...slots.keys()])clearSlot(key);
    Object.values(roots).forEach(g=>g.removeFromParent());Object.values(materials).forEach(m=>m.dispose());destroyed=true;destroy();};
  actor[KEY]=controller;actor.appearanceController=controller;buildParts();apply();return controller;
}
