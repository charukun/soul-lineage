import test from 'node:test';
import assert from 'node:assert/strict';
import {createQAReport,attachMotionPerceptionQA,serializeQAReport,deserializeQAReport,validateMotionPerceptionEvidence} from '../src/motion-qa.js';
import {motionReadabilityReport,perceptualTrajectoryDiagnostics,motionLodProfile,createMotionPerceptionEvidence} from '../src/motion-life.js';

const review={fps:60,sequence:'30s motion-life',characters:['SHINO'],viewport:[390,844],dpr:2,lighting:'qa-neutral',motionRevision:'motion-life-1'};
function evidence(){return createMotionPerceptionEvidence({readability:motionReadabilityReport({keyframes:[{id:'contact',body:[0,1,0],weaponBase:[.1,1,.1],weaponTip:[.55,1.2,.45]}]}),trajectory:perceptualTrajectoryDiagnostics([{t:0,x:0,y:0,z:0},{t:.1,x:.1,y:0,z:0},{t:.2,x:.2,y:0,z:0},{t:.3,x:.3,y:0,z:0}],{jerkThreshold:1000}),lod:motionLodProfile({distance:0,isHero:true})});}

test('motion perception attaches to QA v1 without approving visual quality',()=>{
 const report=createQAReport({build:'test',reviewer:'worker',review}),next=attachMotionPerceptionQA(report,evidence());
 assert.equal(next.version,1);assert.equal(next.visualApproval,'pending');assert.equal(next.motionPerception.schema,'motion-perception-qa');assert.equal(report.motionPerception,undefined);
});

test('perception QA round trips through existing report serialization',()=>{
 const next=attachMotionPerceptionQA(createQAReport({build:'test',reviewer:'worker',review}),evidence()),decoded=deserializeQAReport(serializeQAReport(next));
 assert.equal(decoded.motionPerception.visualApprovalRequired,true);assert.equal(decoded.visualApproval,'pending');
});

test('invalid perception evidence fails closed',()=>{
 const e={...evidence(),visualApprovalRequired:false};assert.throws(()=>validateMotionPerceptionEvidence(e));
 const bad={...evidence(),trajectory:{...evidence().trajectory,maxJerk:Infinity}};assert.throws(()=>validateMotionPerceptionEvidence(bad));
});
