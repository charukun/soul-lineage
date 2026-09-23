import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {activateSampledDownedAction,downedPresentationSample} from '../src/downed-presentation.js';

const knightUrl=new URL('../../../apps/review/public/library/model/717b56ca2b5ff5392679774725201ba03a3eefab/Knight.glb',import.meta.url);

async function loadKnight(){
 const bytes=await readFile(fileURLToPath(knightUrl));
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 return await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));
}
function findBone(root,kind){
 let found=null;root.traverse(node=>{if(found||!node.isBone)return;const name=String(node.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(kind==='head'&&/head/.test(name)&&!/headtop|headend/.test(name))found=node;if(kind==='hips'&&/hips|pelvis/.test(name))found=node;});return found;
}
function measure(root){
 root.updateMatrixWorld(true);const head=findBone(root,'head'),hips=findBone(root,'hips');assert.ok(head&&hips,'Knight rig exposes head and hips bones');
 const hp=head.getWorldPosition(new THREE.Vector3()),pp=hips.getWorldPosition(new THREE.Vector3());
 return {head:hp.toArray(),hips:pp.toArray(),vertical:Math.abs(hp.y-pp.y),horizontal:Math.hypot(hp.x-pp.x,hp.z-pp.z)};
}

test('Knight Lie_Down actually changes the authored body pose when sampled through AnimationMixer',async()=>{
 const gltf=await loadKnight(),clip=THREE.AnimationClip.findByName(gltf.animations,'Lie_Down');assert.ok(clip,'Knight.glb contains Lie_Down');
 const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.reset().play();mixer.setTime(0);const standing=measure(gltf.scene);mixer.setTime(Math.max(0,clip.duration-.001));const lying=measure(gltf.scene);
 console.log('LIE_DOWN_GLTF_EVIDENCE',JSON.stringify({duration:clip.duration,standing,lying}));
 assert.ok(lying.vertical<standing.vertical*.72||lying.horizontal>standing.horizontal+.18,'Lie_Down must visibly change head/hips relation');
});

test('sampled downed action applies the same real GLB pose instead of leaving the rig standing',async()=>{
 const gltf=await loadKnight(),clip=THREE.AnimationClip.findByName(gltf.animations,'Lie_Down');const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);
 action.reset().play();mixer.setTime(0);const standing=measure(gltf.scene);
 activateSampledDownedAction(mixer,action);const sample=downedPresentationSample({downed:true,downedState:{phase:'settled',progress:1}},clip.duration);action.time=sample.time;mixer.update(0);gltf.scene.updateMatrixWorld(true);const sampled=measure(gltf.scene);
 console.log('LIE_DOWN_SAMPLED_EVIDENCE',JSON.stringify({duration:clip.duration,sample,standing,sampled,weight:action.getEffectiveWeight(),timeScale:action.getEffectiveTimeScale()}));
 assert.ok(sampled.vertical<standing.vertical*.72||sampled.horizontal>standing.horizontal+.18,'sampled action must visibly leave standing pose');
});
