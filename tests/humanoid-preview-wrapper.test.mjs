import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone, Group, Quaternion, Vector3, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, SkinnedMesh, MeshBasicMaterial, Skeleton, Mesh} from 'three';
import {createHumanoidPreview, inspectHumanoid} from '../packages/rendering/src/humanoid-preview.js';

const definition = [
 ['hips',null,[0,.95,0]], ['spine','hips',[0,.25,0]], ['chest','spine',[0,.2,0]], ['upperChest','chest',[0,.12,0]], ['neck','upperChest',[0,.1,0]], ['head','neck',[0,.17,0]],
 ...['left','right'].flatMap(side=>{const x=side==='left'?1:-1;return [
  [side+'UpperArm','upperChest',[x*.23,0,0]], [side+'LowerArm',side+'UpperArm',[x*.3,0,0]], [side+'Hand',side+'LowerArm',[x*.25,0,0]],
  [side+'UpperLeg','hips',[x*.13,-.1,0]], [side+'LowerLeg',side+'UpperLeg',[0,-.42,0]], [side+'Foot',side+'LowerLeg',[0,-.4,.08]],
 ];}),
];
const mixamo = {hips:'mixamorig:Hips',spine:'mixamorig:Spine',chest:'mixamorig:Spine1',upperChest:'mixamorig:Spine2',neck:'mixamorig:Neck',head:'mixamorig:Head'};
for(const s of ['left','right'])for(const [slot,name] of Object.entries({UpperArm:'Arm',LowerArm:'ForeArm',Hand:'Hand',UpperLeg:'UpLeg',LowerLeg:'Leg',Foot:'Foot'}))mixamo[s+slot]=`mixamorig:${s[0].toUpperCase()+s.slice(1)}${name}`;
function fixture({omit=[],names={},skin=true,scale=1,legScale=1,anonymous=false}={}) {
 const root=new Group(), bones={};
 for(const [slot,parent,offset] of definition) {
  if(omit.includes(slot))continue;
  const b=new Bone();b.name=anonymous?`joint_${Object.keys(bones).length}`:(names[slot]||slot);
  const v=new Vector3(...offset);let p=parent;
  while(p&&!bones[p]){const d=definition.find(row=>row[0]===p);v.add(new Vector3(...d[2]));p=d[1];}
  if(/Leg|Foot/.test(slot))v.multiplyScalar(legScale);
  b.position.copy(v.multiplyScalar(scale));(bones[p]||root).add(b);bones[slot]=b;
 }
 root.updateMatrixWorld(true);
 const list=Object.values(bones), geo=new BufferGeometry(), positions=[], indices=[],weights=[];
 for(let i=0;i<list.length;i++) { positions.push(...list[i].getWorldPosition(new Vector3()).toArray());indices.push(i,0,0,0);weights.push(1,0,0,0); }
 geo.setAttribute('position',new Float32BufferAttribute(positions,3));
 geo.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
 const mesh=skin?new SkinnedMesh(geo,new MeshBasicMaterial()):new Mesh(geo,new MeshBasicMaterial());root.add(mesh);
 if(skin)mesh.bind(new Skeleton(list));
 return {root,bones,mesh};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
const angle=(bone,radians)=>bone.quaternion.setFromAxisAngle(new Vector3(0,0,1),radians);

test('known rigs are a unique binding; CMU and Mixamo spine conventions stay distinct',()=>{
 const f=fixture({names:mixamo}), b=inspectHumanoid(f.root);
 assert.equal(b.report.status,'PLAYABLE');assert.equal(new Set(Object.values(b.bones)).size,18);
 assert.equal(b.bones.chest,f.bones.chest);
 const cmu=fixture({names:{hips:'Hips',spine:'ToSpine',chest:'Spine',upperChest:'Spine1'}});
 assert.equal(inspectHumanoid(cmu.root).bones.chest,cmu.bones.chest);
});
test('an unnamed upright biped is inferred as approximate, not silently approved',()=>{
 const f=fixture({anonymous:true}), b=createHumanoidPreview(f.root);
 assert.equal(b.descriptor.status,'DEGRADED');assert.equal(b.bones.hips,f.bones.hips);
 assert.equal(b.bones.leftFoot,f.bones.leftFoot);assert.ok(b.descriptor.inferred.length>0);
 assert.equal(b.descriptor.productionApproved,false);
});
test('unrigged and unweighted targets are classified, not invented or animated',()=>{
 const bare=new Group();bare.add(new Mesh(new BufferGeometry(),new MeshBasicMaterial()));
 const b=createHumanoidPreview(bare);assert.equal(b.descriptor.status,'RIG_REQUIRED');
 const s=createHumanoidPreview(fixture().root,{role:'source'}).capture();
 assert.equal(b.apply(s).applied,false);
 const f=fixture({skin:false});assert.equal(createHumanoidPreview(f.root).descriptor.status,'RIG_REQUIRED');
});
test('a source skeleton can be used without a rendered skin',()=>{
 const f=fixture({skin:false}), b=createHumanoidPreview(f.root,{role:'source'});
 assert.equal(b.descriptor.status,'PLAYABLE');assert.ok(b.capture().rotations.hips);
});
test('explicit stable paths are serializable and duplicate assignments fail',()=>{
 const f=fixture(), first=inspectHumanoid(f.root);
 const b=createHumanoidPreview(f.root,{mapping:{hips:first.report.mapping.hips},assetHash:'git-sha1:abc'});
 const descriptor=JSON.parse(JSON.stringify(b.descriptor));assert.equal(descriptor.methods.hips,'explicit');
 assert.equal(descriptor.assetHash,'git-sha1:abc');assert.equal(descriptor.version,1);
 assert.throws(()=>createHumanoidPreview(f.root,{mapping:{hips:first.report.mapping.hips,spine:first.report.mapping.hips}}),/duplicate/);
 assert.notEqual(b.descriptor.cacheIdentity,createHumanoidPreview(f.root,{assetHash:'git-sha1:def'}).descriptor.cacheIdentity);
});
test('partial limbs still move and missing torso rotations compose once',()=>{
 const src=fixture(), source=createHumanoidPreview(src.root,{role:'source'});
 angle(src.bones.chest,.2);angle(src.bones.upperChest,.3);angle(src.bones.leftUpperArm,.4);
 const dst=fixture({omit:['chest','upperChest','rightLowerArm']}), target=createHumanoidPreview(dst.root,{infer:false});
 const p=source.capture(), r=target.apply(p);assert.equal(r.status,'DEGRADED');assert.equal(r.applied,true);
 near(dst.bones.spine.quaternion.z,Math.sin(.5/2));near(dst.bones.leftUpperArm.quaternion.z,Math.sin(.4/2));
 assert.ok(r.folded.includes('chest'));assert.equal(target.apply(p,{mode:'strict'}).applied,false);
});
test('retargeted pose actually deforms vertices, not only named skeleton metadata',()=>{
 const src=fixture(), source=createHumanoidPreview(src.root,{role:'source'});
 const dst=fixture(), target=createHumanoidPreview(dst.root);
 const index=Object.keys(dst.bones).indexOf('leftHand');
 const vertex=new Vector3().fromBufferAttribute(dst.mesh.geometry.attributes.position,index);
 const before=dst.mesh.applyBoneTransform(index,vertex.clone());angle(src.bones.leftUpperArm,.8);
 assert.equal(target.apply(source.capture()).applied,true);
 const after=dst.mesh.applyBoneTransform(index,vertex.clone());assert.ok(after.distanceTo(before)>.1);
});
test('rest is immutable across repeated applications and source changes',()=>{
 const src=fixture(), source=createHumanoidPreview(src.root,{role:'source'}), rest=source.capture();
 angle(src.bones.leftUpperArm,.5);const pose=source.capture();
 const dst=fixture(), target=createHumanoidPreview(dst.root), length=dst.bones.leftLowerArm.position.length();
 for(let i=0;i<40;i++)target.apply(pose);
 near(dst.bones.leftUpperArm.quaternion.z,Math.sin(.25));near(dst.bones.leftLowerArm.position.length(),length);
 target.apply(rest);near(dst.bones.leftUpperArm.quaternion.angleTo(new Quaternion()),0);
});
test('pelvis motion scales by leg length, with explicit in-place/free/locked policy',()=>{
 const src=fixture(), source=createHumanoidPreview(src.root,{role:'source'});
 src.bones.hips.position.add(new Vector3(.2,.1,.3));const p=source.capture();
 const dst=fixture({scale:2}), target=createHumanoidPreview(dst.root), start=dst.bones.hips.position.clone();
 target.apply(p);near(dst.bones.hips.position.x,start.x);near(dst.bones.hips.position.y-start.y,.2);
 target.apply(p,{rootMotion:'free'});near(dst.bones.hips.position.x-start.x,.4);
 target.apply(p,{rootMotion:'locked'});near(dst.bones.hips.position.distanceTo(start),0);
});
test('wrapper orientation and parent scale do not corrupt target-owned lengths',()=>{
 const src=fixture(), source=createHumanoidPreview(src.root,{role:'source'});src.bones.hips.position.x+=.1;
 const dst=fixture();dst.root.rotation.y=.7;dst.root.scale.set(2,3,4);
 const target=createHumanoidPreview(dst.root);const start=dst.bones.hips.position.clone();
 target.apply(source.capture(),{rootMotion:'free'});near(dst.bones.hips.position.x-start.x,.1);near(dst.bones.hips.position.z-start.z,0);
});
test('unsafe poses and corrupt skin data never mutate a healthy target',()=>{
 const f=fixture(), t=createHumanoidPreview(f.root), before=f.bones.hips.position.clone();
 const p=createHumanoidPreview(fixture().root,{role:'source'}).capture();p.rotations.hips=[NaN,0,0,1];
 assert.equal(t.apply(p).status,'UNSUPPORTED');near(f.bones.hips.position.distanceTo(before),0);
 const bad=fixture();bad.mesh.geometry.attributes.skinWeight.setX(0,NaN);
 assert.equal(createHumanoidPreview(bad.root).descriptor.status,'UNSUPPORTED');
 const reflected=fixture();reflected.root.scale.x=-1;assert.equal(createHumanoidPreview(reflected.root).descriptor.status,'UNSUPPORTED');
});
test('extreme displacement is clamped and reported, never silently accepted',()=>{
 const t=createHumanoidPreview(fixture().root), p=createHumanoidPreview(fixture().root,{role:'source'}).capture();p.hips=[1e20,0,0];
 const r=t.apply(p,{rootMotion:'free'});assert.equal(r.status,'DEGRADED');assert.ok(r.reasons.includes('displacement-clamped'));
 assert.ok(t.bones.hips.position.length()<t.profile.height*3);
});
test('body profiles use measured ratios rather than claimed age or hardcoded model ids',()=>{
 const a=createHumanoidPreview(fixture().root), b=createHumanoidPreview(fixture({legScale:.5}).root);
 assert.ok(b.profile.legLength<a.profile.legLength);assert.equal(b.profile.proportions,'short-legged');
 assert.ok(a.descriptor.cacheIdentity.includes('rest-skeleton-extent'));
});

test('finite overflow input is rejected atomically and large rotation input normalizes safely',()=>{
 const f=fixture(),target=createHumanoidPreview(f.root),p=createHumanoidPreview(fixture().root,{role:'source'}).capture();
 const before=f.bones.hips.position.clone();p.hips=[Number.MAX_VALUE,0,0];
 const result=target.apply(p,{rootMotion:'free'});assert.equal(result.applied,false);assert.equal(result.status,'UNSUPPORTED');
 near(f.bones.hips.position.distanceTo(before),0);
 p.hips=[0,0,0];p.rotations.leftUpperArm=[0,0,1e200,1e200];
 assert.equal(target.apply(p).applied,true);near(f.bones.leftUpperArm.quaternion.length(),1);
});
test('negative animated source scale cannot escape through approximate sampling',()=>{
 const f=fixture(),source=createHumanoidPreview(f.root,{role:'source'});f.bones.leftHand.scale.x=-1;
 assert.throws(()=>source.capture(),/source pose/);
});
