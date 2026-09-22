import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShinoDraft,assertSprite25dManifest,pruneSprite25dAssets} from '../packages/assets/src/sprite25d-manifest.js';
import {createCharacter25dActor,createCharacter25dRig,character25dView,CHARACTER25D_ACTIONS} from '../packages/assets/src/adapters/three/character25d-actor.js';
import {createRinneWeapon,RINNE_EQUIPMENT_PROFILES,resolveRinneEquipment,disposeRinneEquipment} from '../packages/assets/src/adapters/three/runtime-equipment.js';
import {weaponCalibration} from '../packages/animations/src/weapon-calibration.js';

function draft(){
  const d=createShinoDraft(),hash='a'.repeat(64);
  // Decoder is mocked below; these bytes test transform ownership, never art.
  d.assets[hash]={sha256:hash,byteLength:3,width:128,height:256,mediaType:'image/jpeg',name:'transform-fixture.jpg',hasTransparency:true,dataUrl:'data:image/jpeg;base64,/9j/',provenance:{kind:'user-upload',license:'unverified',author:'user-supplied-unverified'}};
  d.pose=hash;d.references.front=hash;d.appearance={version:1,method:'auto-cutout-rig',views:{front:hash,side:hash,back:hash}};return d;
}
const distance=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));
test('RINNE profiles reuse the established calibration schema and weapon IDs',()=>{
  for(const [id,profile]of Object.entries(RINNE_EQUIPMENT_PROFILES)){
    assert.equal(weaponCalibration(profile).id,profile.id);
    const model=createRinneWeapon(THREE,id);assert.equal(model.userData.assetId,`rinne.equipment.${id}`);assert.ok(model.children.length);disposeRinneEquipment(model);
  }
  assert.deepEqual(resolveRinneEquipment({weapon:'spear',shield:true}),{weapon:'spear',shield:false});
  assert.deepEqual(resolveRinneEquipment({weapon:'sword',shield:true}),{weapon:'sword',shield:true});
  assert.deepEqual(resolveRinneEquipment({weapon:'fist',shield:false}),{weapon:null,shield:false});
});
test('proxy socket hierarchy owns weapon, support grip, hitbox, trail and held item',()=>{
  const r=createCharacter25dRig(THREE),s=r.sockets;
  assert.equal(s.weapon.parent,s.rightHand);assert.equal(s.gripFrame.parent,s.weapon);
  for(const key of ['secondaryGripTarget','weaponHitboxAnchor','trailOrigin'])assert.equal(s[key].parent,s.gripFrame);
  assert.equal(s.heldItemAnchor.parent,s.leftHand);assert.equal(s.offhand,s.leftHand);
  assert.equal(r.root.userData.collider.kind,'capsule');assert.ok(!r.root.children.some(n=>n.isMesh));
});
test('moving, attacking, turning and hit poses preserve the same 3D grip and anchors',async t=>{
  const original=globalThis.Image;
  globalThis.Image=class{constructor(){this.width=128;this.height=256;}set src(value){queueMicrotask(()=>this.onload());}};
  t.after(()=>{globalThis.Image=original;});
  const actor=await createCharacter25dActor(THREE,draft()),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);
  const gripErrors=[],supportErrors=[],positions=[];
  for(const weapon of ['sword','axe','spear','great','staff']){
    actor.setEquipment({weapon,shield:true});
    for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI])for(const action of CHARACTER25D_ACTIONS){
      for(let i=0;i<15;i++){
        actor.object.position.x+=.003;actor.update({camera,delta:1/30,yaw,action,moving:action==='walk'||action==='run',speed:4});
        const s=actor.snapshot();gripErrors.push(distance(s.hand,s.actualGrip));
        if(s.twoHanded)supportErrors.push(distance(s.offhand,s.secondaryGrip));
        positions.push(s.trail);assert.ok([...s.hand,...s.trail,...s.hitbox].every(Number.isFinite));
        assert.equal(s.equipment.weapon,weapon);
      }
    }
  }
  assert.ok(Math.max(...gripErrors)<1e-5,`grip error ${Math.max(...gripErrors)}`);
  assert.ok(Math.max(...supportErrors)<.025,`support grip error ${Math.max(...supportErrors)}`);
  assert.ok(distance(positions[0],positions.at(-1))>.1,'trail must follow the moving actor');
  actor.setEquipment({weapon:'fist',shield:false});assert.equal(actor.snapshot().actualGrip,null);
  actor.dispose();actor.dispose();
});
test('view coverage is explicit and missing/back assets cannot bypass validation or pruning',()=>{
  assert.equal(character25dView(0),'front');assert.equal(character25dView(Math.PI/4),'quarter');assert.equal(character25dView(Math.PI/2),'side');assert.equal(character25dView(Math.PI),'back');
  const d=draft();assertSprite25dManifest(d);pruneSprite25dAssets(d);assert.ok(d.assets[d.appearance.views.back]);
  d.appearance.views.back='b'.repeat(64);assert.throws(()=>assertSprite25dManifest(d),/参照先/);
});
