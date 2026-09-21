import * as THREE from 'three';
import {GLTFLoader} from '@soul/rendering';

const SOURCE_COMMIT='15b62b9bad122f72926c10fb14d622c73819fa54';
const SOURCE_ROOT=`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/${SOURCE_COMMIT}/addons/kaykit_character_pack_skeletons/Characters/gltf/`;

export const REVIEW_MONSTER_MODELS=Object.freeze([
  Object.freeze({id:'skeleton-minion',label:'スケルトン',path:'Skeleton_Minion.glb',targetHeight:2.0}),
  Object.freeze({id:'skeleton-warrior',label:'スケルトン戦士',path:'Skeleton_Warrior.glb',targetHeight:2.05}),
  Object.freeze({id:'skeleton-rogue',label:'スケルトン斥候',path:'Skeleton_Rogue.glb',targetHeight:1.95})
]);

const specFor=id=>REVIEW_MONSTER_MODELS.find(row=>row.id===id)||null;
const clipScore=(name,kind)=>{
  const n=String(name||'').toLowerCase();
  if(kind==='dead')return /death|dead|die/.test(n)?5:0;
  if(kind==='attack')return /attack|slash|melee|swing|chop|stab|strike/.test(n)?5:0;
  return /idle|combat.*idle|ready|guard/.test(n)?5:0;
};
const bestClip=(clips,kind)=>clips.reduce((best,clip)=>clipScore(clip.name,kind)>clipScore(best?.name,kind)?clip:best,null)||clips[0]||null;

export async function loadReviewMonsterModel(id){
  const spec=specFor(id);if(!spec)throw new Error(`Unknown review monster: ${id}`);
  const loader=new GLTFLoader(),url=SOURCE_ROOT+spec.path,gltf=await loader.loadAsync(url),visual=gltf.scene;
  visual.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(visual),size=box.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw new Error(`Invalid review monster bounds: ${id}`);
  visual.scale.multiplyScalar(spec.targetHeight/size.y);visual.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(visual);const center=box.getCenter(new THREE.Vector3());
  visual.position.set(visual.position.x-center.x,visual.position.y-box.min.y,visual.position.z-center.z);
  visual.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  const root=new THREE.Group();root.name=`ReviewMonster:${id}`;root.userData.reviewMonster=true;root.userData.reviewMonsterSpecies=id;root.userData.reviewMonsterSource='KayKit Character Pack: Skeletons 1.0';root.add(visual);
  const mixer=gltf.animations?.length?new THREE.AnimationMixer(visual):null,actions={};
  if(mixer){
    for(const kind of ['idle','attack','dead']){const clip=bestClip(gltf.animations,kind);if(clip)actions[kind]=mixer.clipAction(clip);}
    actions.idle?.play();
  }
  return{root,visual,mixer,actions,activeAction:'idle',spec};
}

export function updateReviewMonsterAnimation(instance,state,time,{hit=false}={}){
  if(!instance)return;
  const dead=Boolean(state?.dead)||Number(state?.hp)<=0,attacking=Boolean(state?.attack),kind=dead?'dead':attacking?'attack':'idle';
  if(instance.mixer){
    if(instance.activeAction!==kind){
      const previous=instance.actions?.[instance.activeAction],next=instance.actions?.[kind]||instance.actions?.idle;
      previous?.fadeOut?.(.12);next?.reset?.().fadeIn?.(.12).play?.();instance.activeAction=kind;
    }
    const progress=Math.max(0,Math.min(1,Number(state?.progress)||0));
    const active=instance.actions?.[kind]||instance.actions?.idle;
    if(kind==='attack'&&active?.getClip?.()){const duration=Math.max(.01,active.getClip().duration);active.time=duration*progress;}
    else if(kind==='dead'&&active?.getClip?.()){active.clampWhenFinished=true;active.loop=THREE.LoopOnce;}
    instance.mixer.update(kind==='attack'?0:Math.min(.05,Math.max(0,Number(time)||0)%0.05));
  }
  instance.root.rotation.z=hit?.08*Math.sin(Math.PI*Math.max(0,Math.min(1,Number(state?.progress)||.5))):0;
}

export function disposeReviewMonsterModel(instance){
  if(!instance)return;instance.mixer?.stopAllAction?.();
  instance.visual?.traverse(node=>{node.geometry?.dispose?.();const materials=Array.isArray(node.material)?node.material:[node.material];for(const material of materials.filter(Boolean)){material.map?.dispose?.();material.dispose?.();}});
  instance.root?.removeFromParent?.();
}
