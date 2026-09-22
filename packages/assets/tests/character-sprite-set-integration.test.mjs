import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {assertCharacterSpriteSet,SPRITE_SET_DIRECTIONS} from '../src/character-sprite-set.js';
import {createCharacterSpriteSetActor} from '../src/adapters/three/character-sprite-set.js';
import {inspectSpriteSetPNG} from '../src/adapters/browser/character-sprite-set.js';
import {createSpriteSetSandbox} from '../src/character-sprite-sandbox.js';

const directory=new URL('../../../apps/review/public/sprite-sets/kaykit-knight/',import.meta.url);
const sample=JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8'));
function memoryResources(){
  const manifest=structuredClone(sample),images=new Map(Object.keys(manifest.assets).map(id=>[id,{width:manifest.assets[id].width,height:manifest.assets[id].height}]));
  let disposed=false,count=0;
  return {manifest,bundle:{manifest},images,get disposed(){return disposed;},get decodedCount(){return images.size;},get disposalCount(){return count;},dispose(){count++;disposed=true;images.clear();}};
}
async function actorFixture(){
  const resources=memoryResources(),textures=[];
  class ObservedTexture extends THREE.Texture{constructor(image){super(image);this.disposals=0;this.addEventListener('dispose',()=>this.disposals++);textures.push(this);}}
  const actor=await createCharacterSpriteSetActor({...THREE,Texture:ObservedTexture},null,{playable:true,resourceLoader:async()=>resources});return {actor,resources,textures};
}
test('committed sample has thirteen real, distinct, integrity-bound action PNGs',()=>{
  assertCharacterSpriteSet(sample,{playable:true});assert.equal(Object.keys(sample.actions).length,13);assert.equal(sample.stage,'local-draft');assert.equal(sample.approval.productionApproved,false);
  assert.equal(sample.provenance.sourceGitBlob,'717b56ca2b5ff5392679774725201ba03a3eefab');
  const hashes=new Set();for(const asset of Object.values(sample.assets)){const bytes=readFileSync(new URL(asset.file,directory));assert.equal(bytes.length,asset.byteLength);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);inspectSpriteSetPNG(bytes,asset);hashes.add(asset.sha256);}
  assert.equal(hashes.size,13);
});
test('Three adapter uses final camera, correct pivots and only one decode/upload resource per sheet',async()=>{
  const {actor,textures}=await actorFixture(),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();scene.add(actor.object);actor.setTransform({x:0,y:.7,z:0});
  for(let i=0;i<8;i++){camera.position.set(Math.sin(i*Math.PI/4)*5,2,Math.cos(i*Math.PI/4)*5);camera.updateMatrixWorld(true);actor.mesh.onBeforeRender(null,scene,camera);assert.equal(actor.snapshot().view,SPRITE_SET_DIRECTIONS[i]);}
  for(const action of Object.keys(sample.actions)){
    actor.play(action);actor.update({delta:.3,camera});actor.object.updateMatrixWorld(true);
    const pivot=sample.actions[action].pivot||sample.render.pivot,point=new THREE.Vector3(pivot[0]-.5,.5-pivot[1],0);actor.mesh.localToWorld(point);assert.ok(Math.abs(point.y-.7)<1e-6);
  }
  assert.equal(textures.length,13);assert.equal(actor.snapshot().decodedImages,13);actor.dispose();
});
test('Three/resource disposal is complete and idempotent; attached 3D equipment stays caller-owned',async()=>{
  const {actor,resources,textures}=await actorFixture(),scene=new THREE.Scene();scene.add(actor.object);let geometryDisposed=0,materialDisposed=0;
  actor.mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);actor.mesh.material.addEventListener('dispose',()=>materialDisposed++);
  const equipment=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());let equipmentDisposed=0;equipment.geometry.addEventListener('dispose',()=>equipmentDisposed++);actor.setEquipment('weapon',equipment);
  actor.dispose();actor.dispose();assert.equal(scene.children.length,0);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(resources.disposalCount,1);assert.ok(textures.every(t=>t.disposals===1));assert.equal(actor.snapshot().textures,0);assert.equal(actor.snapshot().decodedImages,0);assert.equal(equipment.parent,null);assert.equal(equipmentDisposed,0);equipment.geometry.dispose();equipment.material.dispose();
});
test('sandbox moves against ground/collision hooks, pauses and performs jump/fall without mutating scene authority',async()=>{
  const {actor}=await actorFixture(),sandbox=createSpriteSetSandbox(actor,{canMoveTo:(x,z)=>Math.abs(x)<1&&Math.abs(z)<1});sandbox.reset();sandbox.play('walk');
  for(let i=0;i<60;i++)sandbox.update(.02);assert.ok(sandbox.snapshot().distanceTravelled>0);assert.ok(Math.abs(sandbox.proxy.position.x)<=1&&Math.abs(sandbox.proxy.position.z)<=1);
  sandbox.pause();const before=structuredClone(sandbox.proxy.position);sandbox.update(.05);assert.deepEqual(sandbox.proxy.position,before);sandbox.pause(false);sandbox.play('jump');let peak=0,fall=false;
  for(let i=0;i<80;i++){sandbox.update(.02);peak=Math.max(peak,sandbox.snapshot().airHeight);fall ||= actor.snapshot().action==='fall';}
  assert.ok(peak>.3);assert.equal(fall,true);assert.equal(sandbox.snapshot().grounded,true);sandbox.dispose();actor.dispose();
});
test('latest-develop legacy v1/v2 guest stays byte-identical behind the compatibility entrypoint',()=>{
  // Reconciled against develop c000b40, including its new shared 3D equipment behavior.
  const bytes=readFileSync(new URL('../../../apps/rinne/src/rebuild/shino25d-legacy-guest.js',import.meta.url));assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),'a0f4d9ff7aaa9094386bf342976223005c59b2b1');
  const entry=readFileSync(new URL('../../../apps/rinne/src/rebuild/shino25d-guest.js',import.meta.url),'utf8');assert.match(entry,/installLegacyGuest/);assert.match(entry,/get\('spriteSet'\)===\s*'1'/);
  const guest=readFileSync(new URL('../../../apps/rinne/src/rebuild/sprite-set-guest.js',import.meta.url),'utf8');assert.doesNotMatch(guest,/localStorage|indexedDB|serializeLife/);assert.match(guest,/event\.source!==window\.opener/);assert.match(guest,/trustedSpriteSetOrigin/);
});

test('world-lighting fill uses the current sprite texture without extra allocations or white wash',async()=>{
  const {actor,textures}=await actorFixture();
  for(const action of Object.keys(sample.actions)){actor.play(action);actor.update({delta:.3});assert.ok(actor.mesh.material.map);assert.equal(actor.mesh.material.emissiveMap,actor.mesh.material.map);assert.equal(actor.mesh.material.emissiveIntensity,.35);}
  assert.equal(textures.length,13);actor.dispose();assert.ok(textures.every(texture=>texture.disposals===1));
});
