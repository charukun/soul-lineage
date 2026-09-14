import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SourceT from '../public/simulator/vendor/three.js';
import { GLTFLoader as SourceLoader } from '../public/simulator/vendor/GLTFLoader.js';
import { createShinoProductionPool,shinoProductionRigFromGLTF } from '@soul/rendering/master-character-production';
import { attachModularAppearanceController } from '@soul/rendering/master-character-modular';
import { createMotionQualityAdapter } from '@soul/rendering/motion-quality';
import { sampleMotionFrames,REVIEW_SWORD_CALIBRATION } from '@soul/animations';
import { appearanceForCharacter,visualIdentityForCharacter } from '@soul/characters';
import { createReviewCohort,reviewSettings,editReviewCharacter } from '../src/character-review-state.js';
import { loadWorkshopMotionSource } from '../src/character-motion-source.js';
const readAsset=async id=>{const path=id.startsWith('motion:')?`motions/${id.slice(7)}.vrma`:`${id}_review.vrm`;const b=await readFile(new URL(`../public/simulator/assets/${path}`,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};

test('actual shipped Shino/VRMA pipeline, clearance, retargeting and cohort regression',async()=>{
  globalThis.self=globalThis;globalThis.window={};
  const original=SourceLoader.prototype.parseAsync;SourceLoader.prototype.parseAsync=function(bytes,path){this.register(()=>({name:'CPUTexture',loadTexture:async()=>new SourceT.Texture()}));return original.call(this,bytes,path);};
  let bank,pool;
  try{
    bank=await loadWorkshopMotionSource({resolveModule:file=>import(new URL(`../public/simulator/src/${file}`,import.meta.url)),readAsset});
    assert.equal(bank.frames.length,1801);assert.equal(bank.revision,'shino-slash-1');
    const loader=new GLTFLoader();loader.register(()=>({name:'CPUTexture',loadTexture:async()=>new T.Texture()}));
    const gltf=await loader.parseAsync(await readAsset('SHINO'),''),rig=await shinoProductionRigFromGLTF(gltf);
    pool=createShinoProductionPool({template:gltf.scene,rig,capacity:12});
    const cohort=createReviewCohort(reviewSettings({count:12}));
    const evidence=[];let worst={penetration:0},maxResidual=0;
    for(let i=0;i<12;i++){
      const record=editReviewCharacter(cohort[i],i?{age:[22,7,22,75][i%4],height:i%2,build:i%3/2}:{age:22}),actor=pool.spawn(record.id),modular=attachModularAppearanceController(actor);
      if(i)modular.setIdentity(visualIdentityForCharacter(record));
      const qa=createMotionQualityAdapter(actor,{height:bank.sourceHeight}),appearance=appearanceForCharacter(record);
      const durations=i===0?Array.from({length:1801},(_,f)=>f/60):[0,11.8,12.7,14,17.2,17.4,17.475,17.62,23.8,26,30];
      let before=0,after=0,maxHandMove=0,maxAngleStep=0,maxBeforeStep=0,previousBefore=null,worstStep=null,previous=null,stepTime=0;
      for(const time of durations){
        const pose=sampleMotionFrames(bank,time);actor.sample(appearance,time,()=>qa.apply(pose));
        const risk=r=>r.issues.filter(x=>x.category==='self intersection'&&x.code!=='arms-cross').reduce((m,x)=>Math.max(m,x.penetration),0);
        const rawPose=Object.fromEntries(['rightUpperArm','rightLowerArm','rightHand','leftUpperArm','leftLowerArm','leftHand'].map(n=>[n,actor.bones[n].quaternion.clone()]));
        if(previousBefore&&time-stepTime<.02)for(const n of Object.keys(rawPose))maxBeforeStep=Math.max(maxBeforeStep,rawPose[n].angleTo(previousBefore[n]));previousBefore=rawPose;
        const originalRisk=risk(qa.inspect());before=Math.max(before,originalRisk);
        if(originalRisk>worst.penetration)worst={time,penetration:originalRisk,character:record.id};
        if(i===0){const stable=sampleMotionFrames({...bank,frames:bank.qualityFrames},time);actor.sample(appearance,time,()=>qa.apply(stable));}
        const hand=qa.point('rightHand').clone(),corrected=qa.correct(),remaining=risk(corrected);
        after=Math.max(after,remaining);maxResidual=Math.max(maxResidual,remaining);maxHandMove=Math.max(maxHandMove,hand.distanceTo(qa.point('rightHand')));
        assert.ok(remaining<=originalRisk+1e-5,`worse clearance ${i} ${time}: ${originalRisk} -> ${remaining}`);
        for(const bone of Object.values(actor.bones))assert.ok(bone.quaternion.toArray().every(Number.isFinite));
        const current=Object.fromEntries(['rightUpperArm','rightLowerArm','rightHand','leftUpperArm','leftLowerArm','leftHand'].map(n=>[n,actor.bones[n].quaternion.clone()]));
        if(previous&&time-stepTime<.02)for(const n of Object.keys(current))if(current[n].angleTo(previous[n])>maxAngleStep){maxAngleStep=current[n].angleTo(previous[n]);worstStep={time,bone:n};}previous=current;stepTime=time;
      }
      const sword=new T.Group();qa.calibrateWeapon(sword,REVIEW_SWORD_CALIBRATION,bank.socket,{appearanceScale:appearance.scale});
      const grip=new T.Vector3(...REVIEW_SWORD_CALIBRATION.grip).applyMatrix4(sword.matrixWorld),palm=actor.bones.rightHand.localToWorld(new T.Vector3(...bank.socket.position));
      assert.ok(grip.distanceTo(palm)<1e-6,'geometry grip must stay at palm across body scales');
      const two=qa.calibrateWeapon(sword,{...REVIEW_SWORD_CALIBRATION,twoHanded:true,supportGrip:[0,-.25,0]},bank.socket,{appearanceScale:appearance.scale});
      assert.ok(two.supportError<.01,`two-hand palm contact ${i}: ${two.supportError}`);
      evidence.push({index:i,age:record.ageMs/60000,before,after,maxHandMove,maxAngleStep,maxBeforeStep,worstStep});
    }
    console.log('MOTION_QA_RIG',JSON.stringify({worst,maxResidual,evidence}));
    assert.ok(worst.penetration>.005,'must reproduce the existing arm/torso risk');
    assert.ok(evidence[0].after<evidence[0].before*.4,'baseline Shino improvement');
    assert.ok(evidence[0].maxAngleStep<evidence[0].maxBeforeStep*.6,'transition envelope improves without altering skill timing');
  }finally{pool?.dispose();SourceLoader.prototype.parseAsync=original;delete globalThis.window;delete globalThis.self;}
});
