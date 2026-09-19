import * as THREE from 'three';
import {GLTFLoader} from '@soul/rendering';

const SOURCE_COMMIT='0d654ab3306515b1b63621a5c6548554034482dc';
const SOURCE_ROOT=`https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/${SOURCE_COMMIT}/`;
const CLIPS=Object.freeze({idle:[0,29],attack:[30,59],dead:[60,89]});

export const REVIEW_MONSTER_MODELS=Object.freeze([
  Object.freeze({id:'goblin-runt',label:'ゴブリン',path:'minion/minion-a01.glb',targetHeight:2.0}),
  Object.freeze({id:'horn-brute',label:'角鬼',path:'minion/minion-b01.glb',targetHeight:2.05}),
  Object.freeze({id:'maw-stalker',label:'異形獣',path:'minion/minion-c01.glb',targetHeight:1.95})
]);

const specFor=id=>REVIEW_MONSTER_MODELS.find(row=>row.id===id)||null;
const animationTime=(state,time,progress)=>{
  const range=CLIPS[state]||CLIPS.idle,[start,end]=range,fps=24,first=start/fps,last=end/fps;
  if(state==='dead')return last;
  if(state==='attack')return first+(last-first)*Math.max(0,Math.min(1,Number(progress)||0));
  const duration=Math.max(1/fps,(end-start+1)/fps),clock=((Number(time)||0)%duration+duration)%duration;
  return first+clock;
};

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
  const root=new THREE.Group();root.name=`ReviewMonster:${id}`;root.userData.reviewMonster=true;root.userData.reviewMonsterSpecies=id;root.userData.reviewMonsterSource='Gobkit Free 3D Assets';root.add(visual);
  let mixer=null,clip=null;if(gltf.animations?.length){clip=gltf.animations[0];mixer=new THREE.AnimationMixer(visual);mixer.clipAction(clip).play();mixer.setTime(0);}
  return{root,visual,mixer,clip,spec};
}

export function updateReviewMonsterAnimation(instance,state,time,{hit=false}={}){
  if(!instance)return;
  const dead=Boolean(state?.dead)||Number(state?.hp)<=0,attacking=Boolean(state?.attack),kind=dead?'dead':attacking?'attack':'idle';
  if(instance.mixer&&instance.clip){const sample=Math.min(animationTime(kind,time,state?.progress),Math.max(0,instance.clip.duration-1/24));instance.mixer.setTime(sample);}
  instance.root.rotation.z=hit?.08*Math.sin(Math.PI*Math.max(0,Math.min(1,Number(state?.progress)||.5))):0;
}

export function disposeReviewMonsterModel(instance){
  if(!instance)return;instance.mixer?.stopAllAction?.();
  instance.visual?.traverse(node=>{node.geometry?.dispose?.();const materials=Array.isArray(node.material)?node.material:[node.material];for(const material of materials.filter(Boolean)){material.map?.dispose?.();material.dispose?.();}});
  instance.root?.removeFromParent?.();
}
