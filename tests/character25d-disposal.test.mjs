import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCharacter25DDraft} from '../packages/assets/src/character25d-schema.js';
import {createCharacter25DActor} from '../packages/assets/src/adapters/three/character25d-actor.js';

function bundle(){const d=createCharacter25DDraft({id:'test.actor',name:'runtime fixture'}),hash='a'.repeat(64);d.assets[hash]={sha256:hash,byteLength:8,mediaType:'image/png',width:80,height:120,name:'fixture.png',hasTransparency:true,dataUrl:'data:image/png;base64,iVBORw0KGgo=',provenance:{kind:'user-upload',author:'user-supplied-unverified',license:'unverified'}};d.references.front=d.pose=hash;for(const name of ['front','side','back'])d.appearance[name]={asset:hash,bounds:[0,0,80,120],side:'unknown',mirror:false,status:'detected-candidate'};d.provenance.sourceSha256=hash;d.provenance.sourceDimensions=[80,120];return d;}
function imagePort(t){const original=globalThis.Image;globalThis.Image=class{constructor(){this.width=this.naturalWidth=80;this.height=this.naturalHeight=120;}set src(value){queueMicrotask(()=>this.onload());}};t.after(()=>{globalThis.Image=original;});}
test('real Three skeletons deform layered meshes, sockets follow, and owned resources dispose exactly once',async t=>{
  imagePort(t);const actor=await createCharacter25DActor(THREE,bundle()),camera=new THREE.PerspectiveCamera();camera.position.set(0,1.5,5);actor.setTransform({x:0,y:0,z:0});actor.play('attack');
  for(let i=0;i<12;i++)actor.update({camera,delta:.016});const before=actor.sockets.weapon.getWorldPosition(new THREE.Vector3());actor.play('hit');for(let i=0;i<10;i++)actor.update({camera,delta:.016});const after=actor.sockets.weapon.getWorldPosition(new THREE.Vector3());assert.ok(before.distanceTo(after)>.001);
  const snap=actor.snapshot();assert.equal(snap.bodyBones,18);assert.ok(snap.layerMeshes>=6);assert.equal(snap.textures,1);assert.equal(snap.mirror,false);assert.equal(snap.grounded,true);
  const geometries=new Set(),materials=new Set(),textures=new Set();actor.object.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material){materials.add(n.material);if(n.material.map)textures.add(n.material.map);}});
  const counts=new Map();for(const r of [...geometries,...materials,...textures]){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
  const equipment=new THREE.Group();actor.setEquipment('weapon',equipment);actor.dispose();actor.dispose();assert.equal(equipment.parent,null);for(const count of counts.values())assert.equal(count,1);assert.equal(actor.snapshot().textures,0);
});
