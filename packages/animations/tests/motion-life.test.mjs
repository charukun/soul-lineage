import test from 'node:test';
import assert from 'node:assert/strict';
import {anticipationRecoveryEnvelope,gazeAim,gripStrengthProfile,secondaryMotionStep,poseSpaceCorrective,comboMomentumCarry,motionReadabilityReport,perceptualTrajectoryDiagnostics,motionLodProfile,createMotionPerceptionEvidence} from '../src/motion-life.js';

const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('anticipation and recovery live inside the existing normalized attack phase',()=>{
 const start=anticipationRecoveryEnvelope({phase:0}),load=anticipationRecoveryEnvelope({phase:.12}),contact=anticipationRecoveryEnvelope({phase:.5}),recover=anticipationRecoveryEnvelope({phase:.86}),end=anticipationRecoveryEnvelope({phase:1});
 assert.equal(start.anticipation,0);assert.ok(load.anticipation>.9);assert.ok(contact.drive>.5);assert.ok(recover.recovery>.9);assert.equal(end.recovery,0);
});

test('gaze aim uses shortest yaw and clamps head pitch/yaw',()=>{
 const a=gazeAim({origin:[0,1.5,0],target:[10,5,.1],bodyYaw:0,maxYaw:.4,maxPitch:.2});
 assert.equal(a.yaw,.4);assert.equal(a.pitch,.2);
 const b=gazeAim({origin:[0,1,0],target:[-.1,1,-1],bodyYaw:Math.PI-.05,maxYaw:.5,maxPitch:.2});
 assert.ok(Math.abs(b.yaw)<.2);
});

test('grip tightens around contact and relaxes into recovery',()=>{
 const early=gripStrengthProfile({phase:.05}),impact=gripStrengthProfile({phase:.5}),late=gripStrengthProfile({phase:.95});
 assert.ok(impact>early);assert.ok(impact>late);assert.ok(late>.4&&late<.6);
});

test('secondary motion spring stays bounded and overshoots without exploding',()=>{
 let state={offset:0,velocity:0};
 for(let i=0;i<30;i++)state=secondaryMotionStep({...state,target:i<10?.12:-.06,dt:1/60,maxOffset:.14});
 assert.ok(Math.abs(state.offset)<=.14+1e-12);assert.ok(Number.isFinite(state.velocity));
});

test('pose-space corrective activates only under stressed joint envelopes',()=>{
 const neutral=poseSpaceCorrective({shoulderElevation:.2,kneeFlex:.2,hipFlex:.2}),loaded=poseSpaceCorrective({shoulderElevation:1.4,kneeFlex:1.7,hipFlex:1.1});
 assert.equal(neutral.shoulder,0);assert.ok(loaded.shoulder>.9);assert.ok(loaded.knee>.5);assert.ok(loaded.upperChestOpen>0);
});

test('combo momentum decays across gap and phase and remains bounded',()=>{
 const immediate=comboMomentumCarry({previous:.5,gap:0,phase:0,max:.35}),late=comboMomentumCarry({previous:.5,gap:.25,phase:.8,max:.35});
 assert.equal(immediate,.35);assert.ok(Math.abs(late)<Math.abs(immediate));
});

test('readability reports weak silhouette views without claiming visual approval',()=>{
 const report=motionReadabilityReport({keyframes:[{id:'contact',body:[0,1,0],weaponBase:[0,1,.05],weaponTip:[.5,1.2,.5]}]});
 assert.equal(report.version,1);assert.equal(report.views.length,8);assert.ok(report.weakestScore>=0&&report.weakestScore<=1);assert.equal(typeof report.readable,'boolean');
});

test('trajectory diagnostics detect reversals and high-jerk jitter',()=>{
 const clean=perceptualTrajectoryDiagnostics([{t:0,x:0,y:0,z:0},{t:.1,x:.1,y:0,z:0},{t:.2,x:.2,y:0,z:0},{t:.3,x:.3,y:0,z:0}],{jerkThreshold:1000});
 assert.equal(clean.reversals,0);assert.equal(clean.smooth,true);
 const noisy=perceptualTrajectoryDiagnostics([{t:0,x:0,y:0,z:0},{t:.05,x:.2,y:0,z:0},{t:.1,x:-.2,y:0,z:0},{t:.15,x:.3,y:0,z:0}],{jerkThreshold:50});
 assert.ok(noisy.reversals>=1);assert.ok(noisy.jitterFrames>=1);
});

test('motion LOD sheds secondary work by distance but hero stays full',()=>{
 assert.equal(motionLodProfile({distance:100,isHero:true}).level,'full');
 assert.deepEqual([motionLodProfile({distance:2}).level,motionLodProfile({distance:6}).level,motionLodProfile({distance:12}).level,motionLodProfile({distance:30}).level],['full','near','mid','far']);
 assert.equal(motionLodProfile({distance:30}).secondaryBones,0);
});

test('perception evidence remains diagnostic and requires explicit visual approval',()=>{
 const readability=motionReadabilityReport({keyframes:[{id:'contact',body:[0,1,0],weaponBase:[0,1,0],weaponTip:[.4,1.2,.4]}]}),trajectory=perceptualTrajectoryDiagnostics([{t:0,x:0,y:0,z:0},{t:.1,x:.1,y:0,z:0},{t:.2,x:.2,y:0,z:0},{t:.3,x:.3,y:0,z:0}],{jerkThreshold:1000}),lod=motionLodProfile({distance:0,isHero:true}),evidence=createMotionPerceptionEvidence({readability,trajectory,lod});
 assert.equal(evidence.schema,'motion-perception-qa');assert.equal(evidence.visualApprovalRequired,true);assert.equal(Object.isFrozen(evidence),true);
});
