import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SourceT from '../public/simulator/vendor/three.js';
import { GLTFLoader as SourceLoader } from '../public/simulator/vendor/GLTFLoader.js';
import { createShinoProductionPool,shinoProductionRigFromGLTF } from '@soul/rendering/master-character-production';
import { attachModularAppearanceController } from '@soul/rendering/master-character-modular';
import { createMotionQualityAdapter,hierarchyQuaternion } from '@soul/rendering/motion-quality';
import { sampleMotionFrames,REVIEW_SWORD_CALIBRATION,createCorrectionSampler } from '@soul/animations';
import { appearanceForCharacter,visualIdentityForCharacter } from '@soul/characters';
import { createReviewCohort,reviewSettings,editReviewCharacter } from '../src/character-review-state.js';
import { loadWorkshopMotionSource } from '../src/character-motion-source.js';
const readAsset=async id=>{const path=id.startsWith('motion:')?`motions/${id.slice(7)}.vrma`:`${id}_review.vrm`;const b=await readFile(new URL(`../public/simulator/assets/${path}`,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};


test('continuous correction and carry transfer preserve expressive motion across real body variants',async()=>{
  globalThis.self=globalThis;globalThis.window={};
  const original=SourceLoader.prototype.parseAsync;SourceLoader.prototype.parseAsync=function(bytes,path){this.register(()=>({name:'CPUTexture',loadTexture:async()=>new SourceT.Texture()}));return original.call(this,bytes,path);};
  let pool;
  try{
    const bank=await loadWorkshopMotionSource({resolveModule:file=>import(new URL(`../public/simulator/src/${file}`,import.meta.url)),readAsset});
    const loader=new GLTFLoader();loader.register(()=>({name:'CPUTexture',loadTexture:async()=>new T.Texture()}));
    const gltf=await loader.parseAsync(await readAsset('SHINO'),''),rig=await shinoProductionRigFromGLTF(gltf);
    pool=createShinoProductionPool({template:gltf.scene,rig,capacity:12});
    const cohort=createReviewCohort(reviewSettings({count:12})),evidence=[];
    const names=['rightUpperArm','rightLowerArm','rightHand','leftUpperArm','leftLowerArm','leftHand'];
    const risk=r=>Math.max(0,...r.issues.filter(x=>x.category==='self intersection'&&x.code!=='arms-cross').map(x=>x.penetration));
    const rotations=a=>Object.fromEntries(names.map(n=>[n,a.bones[n].quaternion.clone()]));
    for(let i=0;i<12;i++){
      const record=editReviewCharacter(cohort[i],i?{age:[22,7,22,75][i%4],height:i%2,build:i%3/2}:{age:22}),saved=structuredClone(record);
      const actor=pool.spawn(record.id),modular=attachModularAppearanceController(actor);if(i)modular.setIdentity(visualIdentityForCharacter(record));
      const qa=createMotionQualityAdapter(actor,{height:bank.sourceHeight}),appearance=appearanceForCharacter(record);
      const base=t=>actor.sample(appearance,t,()=>qa.apply(sampleMotionFrames({...bank,frames:bank.qualityFrames},t)));
      const sampler=createCorrectionSampler({duration:30,evaluate:t=>{base(t);return qa.measureCorrection();}});
      const times=i===0?Array.from({length:1801},(_,f)=>f/60):[...Array.from({length:30},(_,n)=>(1025+n)/60),...Array.from({length:17},(_,n)=>(697+n)/60),...Array.from({length:17},(_,n)=>(1552+n)/60)];
      let legacyRisk=0,continuousRisk=0,legacyStep=0,continuousStep=0,previous=null,previousLegacy=null,lastTime=-1,maxPalmTurn=0;
      for(const time of times){
        base(time);legacyRisk=Math.max(legacyRisk,risk(qa.correct()));const legacy=rotations(actor);
        const correction=sampler.sample(time);base(time);const hand=hierarchyQuaternion(actor.bones.rightHand);
        const quality=qa.applyCorrection(correction);continuousRisk=Math.max(continuousRisk,risk(quality));
        maxPalmTurn=Math.max(maxPalmTurn,hand.angleTo(hierarchyQuaternion(actor.bones.rightHand)));
        qa.matchWeaponTransfer(REVIEW_SWORD_CALIBRATION,bank.socket,bank.attachments[Math.round(time*60)].draw);
        const now=rotations(actor);for(const q of Object.values(now))assert.ok(q.toArray().every(Number.isFinite));
        if(previous&&time-lastTime>0&&time-lastTime<.02)for(const n of names){legacyStep=Math.max(legacyStep,legacy[n].angleTo(previousLegacy[n]));continuousStep=Math.max(continuousStep,now[n].angleTo(previous[n]));}
        previous=now;previousLegacy=legacy;lastTime=time;
      }
      assert.ok(continuousRisk<=legacyRisk+.001,`clearance regression ${i}: ${legacyRisk} -> ${continuousRisk}`);
      assert.ok(maxPalmTurn<1e-6,'authored world palm rotation and blade direction are preserved');
      // Seeking order must not leak a previous pose into a deterministic frame.
      const at=t=>{const c=sampler.sample(t);base(t);qa.applyCorrection(c);return rotations(actor);};
      const first=at(17.475);at(25.5);sampler.clear();const second=at(17.475);for(const n of names)assert.ok(first[n].angleTo(second[n])<1e-7);
      let transferBefore=0,transferAfter=0;
      for(const t of [11.75,26]){
        at(t);const sword=new T.Group();qa.calibrateCarriedWeapon(sword,REVIEW_SWORD_CALIBRATION,{appearanceScale:appearance.scale});
        const carry=new T.Vector3(...REVIEW_SWORD_CALIBRATION.grip).applyMatrix4(sword.matrixWorld);
        transferBefore=Math.max(transferBefore,actor.bones.rightHand.localToWorld(new T.Vector3(...bank.socket.position)).distanceTo(carry));
        const match=qa.matchWeaponTransfer(REVIEW_SWORD_CALIBRATION,bank.socket,.25);transferAfter=Math.max(transferAfter,match.error);
        qa.calibrateWeapon(sword,REVIEW_SWORD_CALIBRATION,bank.socket,{appearanceScale:appearance.scale});
        const handGrip=new T.Vector3(...REVIEW_SWORD_CALIBRATION.grip).applyMatrix4(sword.matrixWorld);
        assert.ok(handGrip.distanceTo(carry)<1e-5,`handoff teleport ${i}: ${handGrip.distanceTo(carry)}`);
      }
      assert.deepEqual(record,saved);evidence.push({index:i,age:record.ageMs/60000,legacyRisk,continuousRisk,legacyStep,continuousStep,maxPalmTurn,transferBefore,transferAfter});
    }
    console.log('MOTION_CONTINUITY_RIG',JSON.stringify(evidence));
    assert.ok(evidence[0].continuousStep<evidence[0].legacyStep*.8,'reduce correction switching without filtering action keys');
    assert.ok(evidence.some(row=>row.transferBefore>.02),'reproduce existing body-variant handoff mismatch');
    assert.ok(evidence.every(row=>row.transferAfter<1e-5),'one shared transfer profile fixes all measured palms');
  }finally{pool?.dispose();SourceLoader.prototype.parseAsync=original;delete globalThis.window;delete globalThis.self;}
});
