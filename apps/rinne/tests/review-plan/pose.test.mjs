import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../../public/simulator/vendor/three.js';
import {GLTFLoader} from '../../public/simulator/vendor/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '../../public/simulator/vendor/three-vrm.module.js';
import {createMartialClips} from '../../src/review/martial-motion.js';
import {rawClipFromNormalized,sampleRawClip} from '../../src/review/pose-transfer.js';
globalThis.self=globalThis;
// Skeleton-math test only. Browser suite separately loads the original textures.
const loader=new GLTFLoader();loader.register(()=>({name:'SkeletonMathOnly',loadTexture:()=>Promise.resolve(null)}));loader.register(p=>new VRMLoaderPlugin(p));
const bytes=readFileSync(new URL('../../public/simulator/assets/SHINO_review.vrm',import.meta.url));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const vrm=gltf.userData.vrm;VRMUtils.rotateVRM0(vrm);vrm.update(0);
const result=createMartialClips(vrm),bones=result.bones;
const raw=Object.fromEntries(Object.keys(bones).map(n=>[n,vrm.humanoid.getRawBoneNode(n)]).filter(([,b])=>b));
function sample(clip,map,time){const by=new Map(Object.values(map).map(b=>[b.uuid,b]));for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),b=by.get(track.name.slice(0,dot));if(b)b[track.name.slice(dot+1)].fromArray(track.createInterpolant().evaluate(time));}}
const point=n=>raw[n].getWorldPosition(new T.Vector3());
const output=rawClipFromNormalized(result.Attack,bones,vrm,raw,'Tidebreak / Attack');
const observations=[];
test('official VRM conversion reproduces source raw rotations, including at reversed seeks',()=>{
 for(const time of [0,.2,.36,.56,.98,1.45,.56,0]){
  sample(result.Attack,bones,time);vrm.humanoid.update();vrm.scene.updateMatrixWorld(true);
  const expected=Object.fromEntries(Object.entries(raw).map(([n,b])=>[n,{q:b.quaternion.clone(),p:b.position.clone()}]));
  sample(output,raw,time);vrm.scene.updateMatrixWorld(true);
  for(const[n,b]of Object.entries(raw)){assert.ok(b.quaternion.clone().normalize().angleTo(expected[n].q.clone().normalize())<.00003,n);if(n==='hips')assert.ok(b.position.distanceTo(expected[n].p)<.000001);}
  const shoulder=point('rightUpperArm'),elbow=point('rightLowerArm'),hand=point('rightHand');
  observations.push({time,shoulder:shoulder.toArray(),elbow:elbow.toArray(),hand:hand.toArray(),left:point('leftHand').toArray(),feet:[point('leftFoot').toArray(),point('rightFoot').toArray()],elbowDegrees:elbow.clone().sub(shoulder).angleTo(hand.clone().sub(elbow))*180/Math.PI});
 }
});
test('Attack begins and ends at the same guarded pose; middle frames extend the right hand',()=>{
 const at=t=>{sample(result.Attack,bones,t);vrm.humanoid.update();vrm.scene.updateMatrixWorld(true);return{r:point('rightHand'),l:point('leftHand'),foot:point('leftFoot')}};
 const start=at(0),impact=at(.56),end=at(1.45);
 assert.ok(start.r.distanceTo(end.r)<1e-5);assert.ok(start.l.distanceTo(end.l)<1e-5);
 assert.ok(impact.r.z-start.r.z>.15,'right fist must visibly extend forward');
 assert.ok(start.l.distanceTo(impact.l)<.05,'offhand remains in guard');
 assert.ok(start.foot.distanceTo(impact.foot)<.02,'support foot remains planted');
});
test('all output tracks and orientations remain finite and normalized',()=>{for(const tr of output.tracks){assert.ok([...tr.values].every(Number.isFinite));if(tr.name.endsWith('.quaternion'))for(let i=0;i<tr.values.length;i+=4)assert.ok(Math.abs(Math.hypot(...tr.values.slice(i,i+4))-1)<.0002);}});
process.on('exit',()=>{writeFileSync('/tmp/review-pose-observations.json',JSON.stringify(observations,null,2));});

test('paused and reverse seeks explicitly reapply the raw pose after reset',()=>{
 sampleRawClip(output,vrm.scene,.56);const expected=point('rightHand').clone();
 for(const time of [0,.56,1.45,.56]){for(const b of Object.values(raw))b.quaternion.identity();sampleRawClip(output,vrm.scene,time);if(time===.56)assert.ok(point('rightHand').distanceTo(expected)<1e-6);}
});
