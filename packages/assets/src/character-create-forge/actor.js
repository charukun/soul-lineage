import {validateCharacterPackage,characterPackageCameraSubject} from './contract.js';
import {createRinneWeapon,disposeRinneEquipment,resolveRinneEquipment,RINNE_EQUIPMENT_PROFILES} from '../adapters/three/runtime-equipment.js';
import {createCharacterExpressions} from '../../../characters/src/character-expressions.js';

export function createCharacterPackageActor(THREE,gltf,manifest){
  validateCharacterPackage(manifest);
  const root=gltf.scene,mixer=new THREE.AnimationMixer(root),clips=new Map(gltf.animations.map(c=>[c.name,c])),sockets={},bones={};
  const expressions=manifest.expressions?createCharacterExpressions(root,manifest.expressions):null;
  root.traverse(n=>{if(n.userData.socket)sockets[n.userData.socket]=n;if(n.userData.forgeBone)bones[n.userData.forgeBone]=n;});
  for(const clip of manifest.animations)if(!clips.get(clip.name)?.tracks.length)throw new Error('GLB has no real clip '+clip.name);
  for(const name of Object.keys(manifest.sockets.definitions))if(!sockets[name])throw new Error('Missing exported socket '+name);
  for(const [alias,name] of Object.entries(manifest.sockets.aliases))sockets[alias]=sockets[name];
  const originalMaps=new Map();root.traverse(n=>{if(n.isMesh){n.frustumCulled=false;originalMaps.set(n.material,n.material.map);}});
  let action=null,actionName=null,expressionName='neutral',time=0,paused=false,weapon=null,shield=null,held=null,equipment={weapon:null,shield:false};
  const grip=new THREE.Group();grip.name='ForgeEquipmentGrip';sockets.weapon.add(grip);
  for(const name of ['secondaryGripTarget','weaponHitboxAnchor','trailOrigin'])grip.add(sockets[name]);
  const helper=new THREE.SkeletonHelper(root);helper.visible=false;
  const socketHelpers=[];
  for(const [name,node] of Object.entries(sockets)){if(Object.hasOwn(manifest.sockets.definitions,name)){const marker=new THREE.AxesHelper(.12);marker.visible=false;node.add(marker);socketHelpers.push(marker);}}
  const setAction=name=>{
    if(!clips.has(name))throw new Error('Unknown Character Package clip '+name);
    mixer.stopAllAction();expressions?.reset();expressionName='neutral';root.traverse(n=>n.isSkinnedMesh&&n.skeleton.pose());
    action=mixer.clipAction(clips.get(name));const info=manifest.animations.find(c=>c.name===name);action.setLoop(info.loop?THREE.LoopRepeat:THREE.LoopOnce,info.loop?Infinity:1);action.clampWhenFinished=true;action.reset().play();actionName=name;time=0;mixer.update(0);
  };
  function setEquipment(value={}){
    const next=resolveRinneEquipment(value);if(JSON.stringify(next)===JSON.stringify(equipment))return;
    const main=next.weapon?createRinneWeapon(THREE,next.weapon):null,offhand=next.shield?createRinneWeapon(THREE,'shield'):null;
    disposeRinneEquipment(weapon);disposeRinneEquipment(shield);weapon=main;shield=offhand;equipment=next;
    if(weapon){const p=RINNE_EQUIPMENT_PROFILES[next.weapon];grip.quaternion.fromArray(p.rotation);grip.scale.setScalar(p.scale);grip.position.fromArray(p.grip).multiplyScalar(-p.scale).applyQuaternion(grip.quaternion);grip.add(weapon);sockets.secondaryGripTarget.position.fromArray(p.supportGrip);sockets.weaponHitboxAnchor.position.fromArray(p.bladeBase);sockets.trailOrigin.position.fromArray(p.bladeTip);}
    if(shield){const p=RINNE_EQUIPMENT_PROFILES.shield;shield.scale.setScalar(p.scale);shield.position.fromArray(p.grip).multiplyScalar(-p.scale);sockets.leftHand.add(shield);}
  }
  const api={root,manifest,sockets,helper,mixer,play:setAction,setEquipment,
    expressionNames:expressions?.contract.names||[],
    setExpression(name,weight=1){if(!expressions)throw new Error('This package has no geometric expression contract');expressions.set(name,weight);expressionName=name;},
    get expression(){return expressionName;},
    get action(){return actionName;},get time(){return time;},
    setPaused(value){paused=Boolean(value);},
    neutral(){mixer.stopAllAction();expressions?.reset();expressionName='neutral';root.traverse(n=>n.isSkinnedMesh&&n.skeleton.pose());root.rotation.y=0;time=0;actionName='Bind';root.updateMatrixWorld(true);},
    update(dt){if(!paused){const delta=Math.max(0,Math.min(.1,dt));time+=delta;mixer.update(delta);}root.updateMatrixWorld(true);helper.updateMatrixWorld(true);},
    seek(t){mixer.setTime(Math.max(0,t));time=Math.max(0,t);root.updateMatrixWorld(true);},
    setHeldItem(item){const previous=held;held?.removeFromParent();held=item||null;if(held)sockets.heldItemAnchor.add(held);return previous;},
    setDisplay({texture=true,wireframe=false,skeleton=false,socket=false}){for(const [material,map] of originalMaps){material.map=texture?map:null;material.wireframe=wireframe;material.needsUpdate=true;}helper.visible=skeleton;for(const h of socketHelpers)h.visible=socket;},
    cameraSubject:()=>characterPackageCameraSubject(manifest,{position:root.position,yaw:root.rotation.y,weaponRadius:weapon?1:0}),
    snapshot(){return {id:manifest.id,action:actionName,time,expressions:expressions?.snapshot()||null,bones:manifest.skeleton.bones.map(b=>{const bone=bones[b.name];return {name:b.name,rotation:bone.quaternion.toArray(),position:bone.position.toArray()};}),sockets:Object.fromEntries(Object.entries(sockets).map(([n,s])=>[n,s.getWorldPosition(new THREE.Vector3()).toArray()])),equipment:{...equipment}};},
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);held?.removeFromParent();disposeRinneEquipment(weapon);disposeRinneEquipment(shield);helper.removeFromParent();helper.dispose();for(const h of socketHelpers)h.dispose();root.removeFromParent();const geo=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();root.traverse(n=>{if(n.isMesh){geo.add(n.geometry);materials.add(n.material);if(n.skeleton)skeletons.add(n.skeleton);}});for(const map of originalMaps.values())if(map)textures.add(map);for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);geo.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});skeletons.forEach(s=>s.dispose());}
  };
  setAction('Idle');return api;
}
