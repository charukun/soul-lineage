import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceFootPlantPresentation,sweepWeaponSegmentAgainstCapsule,personalSpaceDesiredVelocity,calibratedMotionLod,createMotionDeviceCalibration} from '../src/index.js';

test('surface foot plant produces material presentation cues without navigation physics',()=>{
 const step=surfaceFootPlantPresentation({surface:'stone',foot:'right',position:{x:1,y:0,z:2},normal:{x:0,y:1,z:0},speed:2,weight:.8,event:{name:'foot-plant'}});
 assert.equal(step.surface,'stone');assert.equal(step.audioCue,'footstep-stone');assert.equal(step.foot,'right');assert.equal(step.navigationPhysicsChanged,false);assert.equal(step.gameplayAuthority,false);
});

test('real segment sweep measures capsule penetration but owns no collision or damage',()=>{
 const hit=sweepWeaponSegmentAgainstCapsule({previousBase:{x:-1,y:1,z:0},previousTip:{x:-.5,y:1,z:0},currentBase:{x:-.4,y:1,z:0},currentTip:{x:.45,y:1,z:0},capsuleStart:{x:0,y:.2,z:0},capsuleEnd:{x:0,y:1.8,z:0},radius:.2,dt:1/60,weaponMass:1.1,hitSerial:7});
 assert.ok(hit);assert.equal(hit.geometry,'segment-capsule');assert.equal(hit.measuredPenetration,true);assert.equal(hit.hitSerial,7);assert.equal(hit.damageAuthority,false);assert.equal(hit.collisionAuthority,false);assert.ok(hit.penetration>0);
 const miss=sweepWeaponSegmentAgainstCapsule({previousBase:{x:-2,y:1,z:0},previousTip:{x:-1.5,y:1,z:0},currentBase:{x:-2,y:1,z:0},currentTip:{x:-1.5,y:1,z:0},capsuleStart:{x:0,y:0,z:0},capsuleEnd:{x:0,y:2,z:0},radius:.2});
 assert.equal(miss,null);
});

test('personal space desired velocity is bounded and leaves navigation authority to consumer',()=>{
 const result=personalSpaceDesiredVelocity({position:{x:0,z:0},preferredVelocity:{x:2,z:0},neighbors:[{x:-.15,z:0},{x:0,z:.2}],radius:.8,maxSuggestion:.3,maxSpeed:2.05});
 assert.ok(Math.hypot(result.desiredVelocity.x,result.desiredVelocity.z)<=2.05+1e-9);assert.equal(result.accepted,true);assert.equal(result.worldAuthority,false);assert.equal(result.consumerOwnsNavigation,true);
});

test('motion LOD only applies from explicit physical-device evidence',()=>{
 const design=createMotionDeviceCalibration({deviceClass:'pixel-fold-class-30',physicalDevice:false,cohort:12,sampleCount:120,totalMeanMs:7,layers:[{layer:'secondary',meanMs:2,maxMs:4}]});
 assert.equal(calibratedMotionLod(design).apply,false);
 const physical=createMotionDeviceCalibration({deviceClass:'pixel-fold-class-30',physicalDevice:true,userAgent:'Pixel Fold physical QA',cohort:12,sampleCount:120,totalMeanMs:7.4,layers:[{layer:'secondary',meanMs:2,maxMs:4},{layer:'pose-search',meanMs:1.1,maxMs:2}]});
 const lod=calibratedMotionLod(physical,{budgetMs:5.5});assert.equal(lod.apply,true);assert.ok(['near','mid','far'].includes(lod.tier));assert.equal(lod.contactSamplingRate,1);assert.equal(lod.damageRate,1);assert.equal(lod.mayDisableGameplay,false);
});
