import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCharacter25DDraft,CHARACTER25D_ACTIONS} from '../packages/assets/src/character25d-schema.js';
import {createCharacter25DActor} from '../packages/assets/src/adapters/three/character25d-actor.js';
import {createRinneWeapon,RINNE_EQUIPMENT_PROFILES,resolveRinneEquipment,disposeRinneEquipment} from '../packages/assets/src/adapters/three/runtime-equipment.js';
import {weaponCalibration} from '../packages/animations/src/weapon-calibration.js';
import {analyzeSilhouette,createHumanoidRig} from '../packages/assets/src/character25d-rig.js';
test('separated palms calibrate the hand pivot from original alpha, hidden hands retain the template',()=>{
  const w=80,h=120,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=30;x<50;x++)data[(y*w+x)*4+3]=255;
  assert.deepEqual(analyzeSilhouette(data,w,h).handLandmarks,{});
  for(let y=54;y<71;y++)for(const [a,b] of [[10,17],[63,70]])for(let x=a;x<b;x++)data[(y*w+x)*4+3]=255;
  const analysis=analyzeSilhouette(data,w,h),rig=createHumanoidRig({...analysis.proportions,handLandmarks:analysis.handLandmarks}),hand=rig.bones.find(b=>b.name==='hand.R').rest;
  assert.ok(hand[0]<-.18);assert.ok(hand[1]>.4&&hand[1]<.47);
});
function draft(){const d=createCharacter25DDraft({id:'test.equipment',name:'equipment fixture'}),hash='a'.repeat(64);d.assets[hash]={sha256:hash,byteLength:8,mediaType:'image/png',width:80,height:120,name:'fixture.png',hasTransparency:true,dataUrl:'data:image/png;base64,iVBORw0KGgo=',provenance:{kind:'user-upload',author:'user-supplied-unverified',license:'unverified'}};d.references.front=d.pose=hash;for(const name of ['front','side','back'])d.appearance[name]={asset:hash,bounds:[0,0,80,120],side:'unknown',mirror:false,status:'detected-candidate'};d.provenance.sourceSha256=hash;d.provenance.sourceDimensions=[80,120];return d;}
const distance=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));
function imagePort(t){const original=globalThis.Image;globalThis.Image=class{constructor(){this.width=this.naturalWidth=80;this.height=this.naturalHeight=120;}set src(value){queueMicrotask(()=>this.onload());}};t.after(()=>{globalThis.Image=original;});}
test('RINNE models use the established calibration schema and domain weapon IDs',()=>{
  for(const [id,p]of Object.entries(RINNE_EQUIPMENT_PROFILES)){assert.equal(weaponCalibration(p).id,p.id);const model=createRinneWeapon(THREE,id);assert.equal(model.userData.assetId,`rinne.equipment.${id}`);disposeRinneEquipment(model);}
  assert.deepEqual(resolveRinneEquipment({weapon:'spear',shield:true}),{weapon:'spear',shield:false});assert.deepEqual(resolveRinneEquipment({weapon:'fist'}),{weapon:null,shield:false});
});
test('moving, attack, hit and facing changes keep both 3D and appearance grips attached',async t=>{
  imagePort(t);const actor=await createCharacter25DActor(THREE,draft()),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);
  const s=actor.sockets;assert.equal(s.weapon.parent,s.rightHand);assert.equal(s.gripFrame.parent,s.weapon);for(const k of ['secondaryGripTarget','weaponHitboxAnchor','trailOrigin'])assert.equal(s[k].parent,s.gripFrame);assert.equal(s.heldItemAnchor.parent,s.offhand);
  let mainError=0,supportError=0,visualError=0;const positions=[];
  for(const weapon of ['sword','axe','spear','great','staff']){
    actor.setEquipment({weapon,shield:true});
    for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5])for(const action of CHARACTER25D_ACTIONS){
      actor.setTransform({x:0,y:0,z:0},yaw);actor.setVelocity({x:0,z:0});actor.play(action);
      for(let i=0;i<12;i++){actor.update({camera,delta:1/30});const snap=actor.snapshot();mainError=Math.max(mainError,distance(snap.hand,snap.actualGrip));if(snap.twoHanded)supportError=Math.max(supportError,distance(snap.offhand,snap.secondaryGrip));visualError=Math.max(visualError,distance(snap.appearanceGrips.R,snap.actualGrip));positions.push(snap.trail);assert.ok([...snap.hand,...snap.trail,...snap.hitbox].every(Number.isFinite));}
    }
  }
  assert.ok(mainError<1e-5,`main grip drift ${mainError}`);assert.ok(supportError<.01,`support grip drift ${supportError}`);assert.ok(visualError<.025,`appearance grip drift ${visualError}`);assert.ok(distance(positions[0],positions.at(-1))>.1);
  actor.setEquipment({weapon:'sword',shield:false},{sword:{grip:[0,.08,0],rotation:[0,0,.1,Math.sqrt(.99)],scale:.6}});actor.play('attack');actor.setVelocity({x:1,z:0});actor.update({camera,delta:.05});let snap=actor.snapshot();assert.equal(snap.action,'attack');assert.ok(snap.position.x>0);assert.ok(distance(snap.hand,snap.actualGrip)<1e-5);actor.releaseAction({locomotionOnly:true});actor.update({camera,delta:.05});assert.equal(actor.snapshot().action,'attack');
  assert.throws(()=>actor.setEquipment({weapon:'sword'},{sword:{scale:-1}}));assert.equal(actor.snapshot().equipment.weapon,'sword');
  actor.setEquipment({weapon:'fist',shield:false});assert.equal(actor.snapshot().actualGrip,null);const prop=new THREE.Group();actor.setHeldItem(prop,{grip:[0,.1,0],rotation:[0,0,0,1],scale:.4});assert.equal(prop.parent,s.heldItemAnchor);actor.setEquipment({weapon:'spear'});assert.equal(s.heldItemAnchor.visible,false);assert.equal(actor.setHeldItem(null),prop);assert.equal(prop.parent,null);
  actor.dispose();actor.dispose();
});
