import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,AnimationClip,VectorKeyframeTrack,QuaternionKeyframeTrack} from 'three';
import {createPreviewMotionSource,loadPinnedMotionSource,loadPinnedReviewTarget} from '../apps/rinne/src/review-motion-source-runtime.js';

function fixture(){
 const scene=new Group(),hips=new Bone(),spine=new Bone(),head=new Bone(),arm=new Bone();
 hips.name='Hips';spine.name='Spine';head.name='Head';arm.name='LeftArm';
 hips.position.y=1;spine.position.y=.3;head.position.y=.3;arm.position.set(.2,.1,0);
 scene.add(hips);hips.add(spine);spine.add(head,arm);
 const animations=[new AnimationClip('lift',1,[new VectorKeyframeTrack('Hips.position',[0,1],[0,1,0,0,1.2,0]),new QuaternionKeyframeTrack('LeftArm.quaternion',[0,1],[0,0,0,1,0,0,Math.sin(.3),Math.cos(.3)])]),new AnimationClip('still',1,[new VectorKeyframeTrack('Hips.position',[0,1],[0,1,0,0,1,0])])];
 return {scene,animations};
}
test('partial source sampling moves continuously and can seek backward after its exact end',()=>{
 const source=createPreviewMotionSource(fixture());assert.equal(source.compatibility.status,'DEGRADED');
 const first=source.sample(0,0),end=source.sample(0,1),half=source.sample(0,.5);
 assert.ok(end.hips[1]>half.hips[1]);assert.ok(half.hips[1]>first.hips[1]);
 assert.ok(Math.abs(half.rotations.leftUpperArm[2])>0);
 assert.throws(()=>source.sample(7,0),/clip/);assert.throws(()=>source.sample(0,NaN),/time/);
 source.dispose();
});
test('switching clips restores unmatched joints rather than retaining the previous pose',()=>{
 const source=createPreviewMotionSource(fixture());source.sample(0,.8);
 const still=source.sample(1,.2);assert.ok(Math.abs(still.rotations.leftUpperArm[2])<1e-6);source.dispose();
});
test('source clip identity validation remains strict in approximate mode',()=>{
 assert.throws(()=>createPreviewMotionSource(fixture(),{expectedClips:[{index:0,name:'wrong'}]}),/count mismatch/);
 assert.throws(()=>createPreviewMotionSource(fixture(),{expectedClips:[{index:0,name:'wrong'},{index:1,name:'still'}]}),/identity mismatch/);
});
test('approximate mode never bypasses source byte-integrity checks',async()=>{
 await assert.rejects(loadPinnedMotionSource('kaykit-general',{preview:true,fetcher:async()=>({ok:true,headers:new Headers(),arrayBuffer:async()=>new ArrayBuffer(1)})}),/length mismatch/);
 await assert.rejects(loadPinnedMotionSource('mesh2motion-review-mannequin',{preview:true}),/reference model/);
});
test('target license, self-hosting and exact bytes are independent of pose tolerance',async()=>{
 const model={license:'CC0-1.0',source:{gitBlobSha:'a'.repeat(40),byteLength:1},runtime:{url:'./body.glb'}};
 const options={baseUrl:'https://example.test/review-motion',fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})};
 await assert.rejects(loadPinnedReviewTarget({...model,license:'conditional'},options),/Unverified/);
 await assert.rejects(loadPinnedReviewTarget({...model,runtime:{url:'https://other.test/a.glb'}},options),/self-hosted/);
 await assert.rejects(loadPinnedReviewTarget(model,options),/integrity mismatch/);
});
