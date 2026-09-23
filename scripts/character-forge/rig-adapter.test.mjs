import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {meshPayload,prepareAttachSpace,attachComputedRig,attachExpressionDeltas} from '../../packages/assets/forge/three_rig_adapter.js';

test('attachment preserves transformed frozen geometry and rotates it about the authored joint',()=>{
  const root=new THREE.Group(),parent=new THREE.Group();root.add(parent);parent.position.set(.13,.2,-.07);parent.rotation.y=.2;
  const original=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshStandardMaterial());original.name='Head surface';original.position.set(0,1.2,.03);original.scale.set(1.2,.9,.8);parent.add(original);root.updateMatrixWorld(true);
  const expected=[];for(let i=0;i<original.geometry.attributes.position.count;i++)expected.push(new THREE.Vector3().fromBufferAttribute(original.geometry.attributes.position,i).applyMatrix4(original.matrixWorld));
  const prepared=prepareAttachSpace(THREE,root);assert.ok(prepared.maxPositionRoundingDelta<1e-6);
  const frozen=meshPayload(root),count=frozen.meshes[0].attributes.position.length/3;
  const contract={bones:[{id:'hips',parent:null,jointPos:[0,.6,0]},{id:'head',parent:'hips',jointPos:[.13,1.2,-.07]}],sockets:{definitions:{talkAnchor:{bone:'head',offset:[0,.24,0]}}}};
  const weights={boneOrder:['hips','head'],meshes:{'Head surface':{skinIndex:Array.from({length:count},()=>[1,0,0,0]).flat(),skinWeight:Array.from({length:count},()=>[1,0,0,0]).flat()}}};
  const rig=attachComputedRig(THREE,root,contract,weights),mesh=rig.meshes[0],after=meshPayload(root);
  for(const key of ['position','normal','uv'])assert.deepEqual(after.meshes[0].attributes[key],frozen.meshes[0].attributes[key]);
  assert.deepEqual(after.meshes[0].index,frozen.meshes[0].index);
  for(let i=0;i<count;i++)assert.ok(mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i)).distanceTo(expected[i])<1e-6);
  const pivot=new THREE.Vector3(.13,1.2,-.07),axis=new THREE.Vector3(0,1,0);rig.bones.head.rotation.y=.7;root.updateMatrixWorld(true);rig.skeleton.update();
  for(let i=0;i<count;i++){
    const actual=mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i));
    const target=expected[i].clone().sub(pivot).applyAxisAngle(axis,.7).add(pivot);assert.ok(actual.distanceTo(target)<1e-6);
  }
  rig.skeleton.pose();root.updateMatrixWorld(true);rig.skeleton.update();
  const neutral=meshPayload(root),deltas=Array.from({length:count},()=>[0,.005,0]);
  attachExpressionDeltas(THREE,rig.meshes,{'Head surface':{vertexCount:count,morphTargetsRelative:true,noOpTargets:[],targets:[{name:'blink',deltas}]}});
  assert.deepEqual(meshPayload(root),neutral,'adding relative targets leaves frozen base buffers unchanged');
  const a=mesh.getVertexPosition(0,new THREE.Vector3());mesh.morphTargetInfluences[0]=1;const b=mesh.getVertexPosition(0,new THREE.Vector3());assert.ok(Math.abs(b.y-a.y-.005)<1e-7);
  assert.equal(rig.sockets.talkAnchor.userData.socket,'talkAnchor');
  assert.throws(()=>prepareAttachSpace(THREE,root),/existing rig/);
});
