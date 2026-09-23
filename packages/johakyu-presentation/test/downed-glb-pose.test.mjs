import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {activateSampledDownedAction,downedPresentationSample} from '../src/downed-presentation.js';

globalThis.self=globalThis;
globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});

const models={
 hero:new URL('../../../apps/review/public/library/model/717b56ca2b5ff5392679774725201ba03a3eefab/Knight.glb',import.meta.url),
 enemy:new URL('../../../apps/review/public/library/model/769e85c9e4cee8d1bd0952ddb3e9d26293144581/Skeleton_Warrior.glb',import.meta.url)
};
async function load(url){const bytes=await readFile(fileURLToPath(url)),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);return await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));}
function findBone(root,kind){let found=null;root.traverse(node=>{if(found||!node.isBone)return;const name=String(node.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(kind==='head'&&/head/.test(name)&&!/headtop|headend/.test(name))found=node;if(kind==='hips'&&/hips|pelvis/.test(name))found=node;});return found;}
function measure(root){root.updateMatrixWorld(true);const head=findBone(root,'head'),hips=findBone(root,'hips');assert.ok(head&&hips);const hp=head.getWorldPosition(new THREE.Vector3()),pp=hips.getWorldPosition(new THREE.Vector3());return{head:hp.toArray(),hips:pp.toArray(),vertical:Math.abs(hp.y-pp.y),horizontal:Math.hypot(hp.x-pp.x,hp.z-pp.z)};}
function moved(a,b){return b.vertical<a.vertical*.72||b.horizontal>a.horizontal+.18;}

for(const [role,url] of Object.entries(models)){
 for(const clone of [false,true])test(role+' Lie_Down changes pose on '+(clone?'SkeletonUtils clone':'source scene'),async()=>{
  const gltf=await load(url),root=clone?cloneSkeleton(gltf.scene):gltf.scene,clip=THREE.AnimationClip.findByName(gltf.animations,'Lie_Down');assert.ok(clip);
  const mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(clip);action.reset().play();mixer.setTime(0);const standing=measure(root);mixer.setTime(Math.max(0,clip.duration-.001));const lying=measure(root);
  console.log('LIE_DOWN_GLTF_EVIDENCE',JSON.stringify({role,clone,duration:clip.duration,standing,lying}));
  assert.ok(moved(standing,lying),role+' '+(clone?'clone':'source')+' must visibly lie down');
 });
 test(role+' game-style cloned sampled action reaches non-standing pose',async()=>{
  const gltf=await load(url),root=cloneSkeleton(gltf.scene),clip=THREE.AnimationClip.findByName(gltf.animations,'Lie_Down'),mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(clip);
  action.reset().play();mixer.setTime(0);const standing=measure(root);activateSampledDownedAction(mixer,action);const sample=downedPresentationSample({downed:true,downedState:{phase:'settled',progress:1}},clip.duration);action.time=sample.time;mixer.update(0);root.updateMatrixWorld(true);const sampled=measure(root);
  console.log('LIE_DOWN_CLONE_SAMPLED_EVIDENCE',JSON.stringify({role,duration:clip.duration,sample,standing,sampled,weight:action.getEffectiveWeight(),timeScale:action.getEffectiveTimeScale()}));
  assert.ok(moved(standing,sampled),role+' cloned sampled action must visibly leave standing pose');
 });
}
