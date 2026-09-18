import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMotionPersonality,locomotionTransition,solveTwoBodyInteraction,conditionMotionProfile,microMotionSample,pairedImpactResponse,bodyMotionAdaptation,createMotionSyncFrame,validateMotionSyncFrame,reconcileMotionSync,createSharedMotionRuntime,MOTION_SYNC_CONTRACT} from '../src/motion-runtime.js';

const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('personality profiles are bounded and meaningfully distinct',()=>{
 const calm=resolveMotionPersonality('calm'),aggressive=resolveMotionPersonality('aggressive'),custom=resolveMotionPersonality('neutral',{tempo:9,posture:-9});
 assert.ok(calm.tempo<aggressive.tempo);assert.ok(calm.gaze<aggressive.gaze);assert.equal(custom.tempo,1.35);assert.equal(custom.posture,-.2);
});

test('locomotion transitions identify start stop pivot and turn-in-place with planted support',()=>{
 assert.equal(locomotionTransition({speed:1,previousSpeed:0,yaw:0,previousYaw:0,plantedSide:'right'}).state,'start');
 assert.equal(locomotionTransition({speed:0,previousSpeed:1,yaw:0,previousYaw:0}).state,'stop');
 assert.equal(locomotionTransition({speed:1,previousSpeed:1,yaw:.8,previousYaw:0}).state,'pivot');
 const turn=locomotionTransition({speed:0,previousSpeed:0,yaw:.8,previousYaw:0,plantedSide:'right'});assert.equal(turn.state,'turn-in-place');assert.equal(turn.supportSide,'right');
});

test('two-body interaction splits bounded correction by inverse mass and faces partners',()=>{
 const plan=solveTwoBodyInteraction({actorA:{x:0,y:0,z:0,yaw:0},actorB:{x:1,y:0,z:0,yaw:0},anchorA:{x:.2,y:1,z:0},anchorB:{x:.8,y:1,z:0},massA:2,massB:1,maxTranslation:.3,maxYaw:.2});
 close(plan.a.offset.x,.1);close(plan.b.offset.x,-.2);assert.equal(plan.bounded,false);assert.ok(Math.abs(plan.a.yaw)<=.2&&Math.abs(plan.b.yaw)<=.2);
});

test('fatigue and injury degrade presentation without producing invalid values',()=>{
 const healthy=conditionMotionProfile(),hurt=conditionMotionProfile({fatigue:.8,injuries:{leftLeg:.9,rightArm:.6,torso:.3}});
 assert.ok(hurt.speedScale<healthy.speedScale);assert.ok(hurt.strideLeft<hurt.strideRight);assert.equal(hurt.limpSide,'left');assert.ok(hurt.weaponSag>0);assert.ok(hurt.recoveryScale>1);
});

test('micro motion is deterministic for seed/time and varies between actors',()=>{
 const a=microMotionSample({time:2.5,seed:'a',fatigue:.4,personality:'calm'}),again=microMotionSample({time:2.5,seed:'a',fatigue:.4,personality:'calm'}),b=microMotionSample({time:2.5,seed:'b',fatigue:.4,personality:'calm'});
 assert.deepEqual(a,again);assert.notEqual(a.headYaw,b.headYaw);assert.ok(a.blink>=0&&a.blink<=1);
});

test('paired impact uses one serial and equal-opposite impulse direction',()=>{
 const r=pairedImpactResponse({serial:7,direction:{x:1,z:1},strength:1.5,massAttacker:2,massDefender:1});
 assert.equal(r.serial,7);assert.equal(r.singleDamageEvent,true);assert.ok(r.attacker.offset.x<0&&r.defender.offset.x>0);close(r.impulse.x,r.impulse.z);
});

test('body adaptation derives bounded reach stride stance and tempo',()=>{
 const a=bodyMotionAdaptation({height:1.2,width:1.1,armLength:1.35,legLength:.9});assert.ok(a.reachScale>1);assert.ok(a.strideScale<1);assert.ok(a.stanceScale>1);assert.ok(a.tempoScale>1);
});

test('motion sync frame separates authoritative and locally reconstructed fields',()=>{
 const f=createMotionSyncFrame({actorId:'hero',sequence:3,clock:4.2,state:'attack',phase:.5,lockedTargetId:'e1',impactSerial:2,position:{x:1,z:2},yaw:.4,condition:{fatigue:.2}});assert.equal(validateMotionSyncFrame(f),true);assert.ok(MOTION_SYNC_CONTRACT.authoritative.includes('impactSerial'));assert.ok(MOTION_SYNC_CONTRACT.reconstructLocally.includes('secondary'));
 const remote=createMotionSyncFrame({actorId:'hero',sequence:4,clock:4.5,state:'attack',phase:.6,lockedTargetId:'e1',impactSerial:3,position:{x:1.5,z:2},yaw:.7});const d=reconcileMotionSync(f,remote);assert.equal(d.remoteNewer,true);assert.equal(d.impactChanged,true);assert.equal(d.reseedPresentation,true);
});

test('shared runtime samples deterministic cross-app presentation state without owning world position',()=>{
 let now=1;const runtime=createSharedMotionRuntime({clock:()=>now}),actor={id:'resident-1'};const first=runtime.sample(actor,{speed:0,yaw:0,personality:'proud',fatigue:.1,body:{height:1.1,width:1}});now=1.1;const second=runtime.sample(actor,{speed:1,yaw:.5,personality:'proud',fatigue:.1,body:{height:1.1,width:1},plantedSide:'right'});assert.equal(first.personality.name,'proud');assert.equal(second.transition.state,'start');assert.equal(second.transition.supportSide,'right');assert.equal('position' in second,false);
});
