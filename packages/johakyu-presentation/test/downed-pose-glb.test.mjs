import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {activateSampledDownedAction,downedPresentationSample,terminalPresentationState} from '../src/downed-presentation.js';

globalThis.self=globalThis;
globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});

const models={
 hero:new URL('../../../apps/review/public/library/model/717b56ca2b5ff5392679774725201ba03a3eefab/Knight.glb',import.meta.url),
 enemy:new URL('../../../apps/review/public/library/model/769e85c9e4cee8d1bd0952ddb3e9d26293144581/Skeleton_Warrior.glb',import.meta.url)
};
async function load(url){
 const b=await readFile(fileURLToPath(url)),buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 return await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));
}
function bone(root,re){let hit;root.traverse(node=>{if(!hit&&node.isBone&&re.test(String(node.name).toLowerCase()))hit=node;});return hit;}
function measure(root){
 root.updateMatrixWorld(true);const head=bone(root,/head/),hips=bone(root,/hips|pelvis/);assert.ok(head&&hips);
 const a=head.getWorldPosition(new THREE.Vector3()),b=hips.getWorldPosition(new THREE.Vector3());
 return {vertical:Math.abs(a.y-b.y),horizontal:Math.hypot(a.x-b.x,a.z-b.z),head:a.toArray(),hips:b.toArray()};
}
function isGroundPose(standing,lying){return lying.vertical<standing.vertical*.72||lying.horizontal>standing.horizontal+.18;}

for(const [role,url] of Object.entries(models))test(role+' settled downed path applies Lie_Pose on the game clone',async()=>{
 const gltf=await load(url),root=cloneSkeleton(gltf.scene),idle=THREE.AnimationClip.findByName(gltf.animations,'Idle');
 const row={downed:true,dead:false,downedState:{phase:'settled',progress:1}},terminal=terminalPresentationState(row,role==='hero'?'hero':'enemy');
 assert.equal(terminal.clip,'Lie_Pose');
 const pose=THREE.AnimationClip.findByName(gltf.animations,terminal.clip);assert.ok(idle&&pose);
 const mixer=new THREE.AnimationMixer(root);mixer.clipAction(idle).reset().play();mixer.setTime(0);const standing=measure(root);
 const action=mixer.clipAction(pose);activateSampledDownedAction(mixer,action);const sample=downedPresentationSample(row,pose.duration);action.time=sample.time;mixer.update(0);root.updateMatrixWorld(true);const lying=measure(root);
 console.log('SETTLED_DOWNED_GLTF_EVIDENCE',JSON.stringify({role,clip:terminal.clip,duration:pose.duration,standing,lying}));
 assert.ok(isGroundPose(standing,lying),role+' settled pose must be visibly on the ground');
});

test('finisher execution preserves the grounded Lie_Pose instead of switching back to a death animation',()=>{
 const executed=terminalPresentationState({downed:true,dead:true},'enemy');
 assert.equal(executed.clip,'Lie_Pose');assert.equal(executed.settled,true);assert.equal(executed.removalClock,true);
});
