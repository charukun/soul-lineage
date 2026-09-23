import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
globalThis.self=globalThis;globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});
const models={hero:new URL('../../../apps/review/public/library/model/717b56ca2b5ff5392679774725201ba03a3eefab/Knight.glb',import.meta.url),enemy:new URL('../../../apps/review/public/library/model/769e85c9e4cee8d1bd0952ddb3e9d26293144581/Skeleton_Warrior.glb',import.meta.url)};
async function load(url){const b=await readFile(fileURLToPath(url)),buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);return await new Promise((res,rej)=>new GLTFLoader().parse(buffer,'',res,rej));}
function bone(root,re){let hit;root.traverse(n=>{if(!hit&&n.isBone&&re.test(String(n.name).toLowerCase()))hit=n;});return hit;}
function measure(root){root.updateMatrixWorld(true);const h=bone(root,/head/),p=bone(root,/hips|pelvis/);assert.ok(h&&p);const a=h.getWorldPosition(new THREE.Vector3()),b=p.getWorldPosition(new THREE.Vector3());return{vertical:Math.abs(a.y-b.y),horizontal:Math.hypot(a.x-b.x,a.z-b.z),head:a.toArray(),hips:b.toArray()};}
for(const [role,url] of Object.entries(models))test(role+' Lie_Pose is a stable ground pose on game clone',async()=>{const gltf=await load(url),root=cloneSkeleton(gltf.scene),idle=THREE.AnimationClip.findByName(gltf.animations,'Idle'),pose=THREE.AnimationClip.findByName(gltf.animations,'Lie_Pose');assert.ok(idle&&pose);const mixer=new THREE.AnimationMixer(root);mixer.clipAction(idle).play();mixer.setTime(0);const standing=measure(root);mixer.stopAllAction();mixer.clipAction(pose).reset().play();mixer.setTime(Math.max(0,pose.duration-.001));const lying=measure(root);console.log('LIE_POSE_GLTF_EVIDENCE',JSON.stringify({role,duration:pose.duration,standing,lying}));assert.ok(lying.vertical<standing.vertical*.72||lying.horizontal>standing.horizontal+.18);});
