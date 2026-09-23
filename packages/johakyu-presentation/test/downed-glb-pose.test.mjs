import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {activateSampledDownedAction,downedPresentationSample} from '../src/downed-presentation.js';

globalThis.self=globalThis;
globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});

const models={
 hero:new URL('../../../apps/review/public/library/model/717b56ca2b5ff5392679774725201ba03a3eefab/Knight.glb',import.meta.url),
 enemy:new URL('../../../apps/review/public/library/model/769e85c9e4cee8d1bd0952ddb3e9d26293144581/Skeleton_Warrior.glb',import.meta.url)
};
async function load(url){
 const bytes=await readFile(fileURLToPath(url)),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 return await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));
}
function findBone(root,kind){
 let found=null;root.traverse(node=>{if(found||!node.isBone)return;const name=String(node.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(kind==='head'&&/head/.test(name)&&!/headtop|headend/.test(name))found=node;if(kind==='hips'&&/hips|pelvis/.test(name))found=node;});return found;
}
function measure(root){
 root.updateMatrixWorld(true);const head=findBone(root,'head'),hips=findBone(root,'hips');assert.ok(head&&hips,'rig exposes head and hips bones');
 const hp=head.getWorldPosition(new THREE.Vector3()),pp=hips.getWorldPosition(new THREE.Vector3());
 return {head:hp.toArray(),hips:pp.toArray(),vertical:Math.abs(hp.y-pp.y),horizontal:Math.hypot(hp.x-pp.x,hp.z-pp.z)};
}
function moved(standing,lying){return lying.vertical<standing.vertical*.72||lying.horizontal>standing.horizontal+.18;}

for(const [role,url] of Object.entries(models)){
 test(role+' Lie_Down changes the authored body pose',async()=>{
  const gltf=await load(url),clip=THREE.AnimationClip.findByName(gltf.animations,'Lie_Down');assert.ok(clip,role+' model contains Lie_Down');
  const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.reset().play();mixer.setTime(0);const standing=measure(gltf.scene);mixer.setTime(Math.max(0,clip.duration-.001));const lying=measure(gltf.scene);
  console.log('LIE_DOWN_GLTF_EVIDENCE',JSON.stringify({role,duration:clip.duration,standing,lying}));
  assert.ok(moved(standing,lying),role+' Lie_Down must visibly change head/hips relation');
 });
 test(role+' sampled downed action reaches the same non-standing pose',async()=>{
  const gltf=await load(url),clip=THREE.AnimationClip.findByName(gltf.animations,'Lie_Down'),mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);
  action.reset().play();mixer.setTime(0);const standing=measure(gltf.scene);
  activateSampledDownedAction(mixer,action);const sample=downedPresentationSample({downed:true,downedState:{phase:'settled',progress:1}},clip.duration);action.time=sample.time;mixer.update(0);gltf.scene.updateMatrixWorld(true);const sampled=measure(gltf.scene);
  console.log('LIE_DOWN_SAMPLED_EVIDENCE',JSON.stringify({role,duration:clip.duration,sample,standing,sampled,weight:action.getEffectiveWeight(),timeScale:action.getEffectiveTimeScale()}));
  assert.ok(moved(standing,sampled),role+' sampled action must visibly leave standing pose');
 });
}
