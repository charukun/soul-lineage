import test from 'node:test';
import assert from 'node:assert/strict';
import {footSlidingDiagnostics,motionJerkDiagnostics,createMotionKinematicsEvidence} from '../src/motion-kinematics-qa.js';

const foot=(xs)=>xs.map((x,i)=>({time:i/60,x,z:0,planted:true}));
test('foot sliding measures world-space displacement only while planted',()=>{const qa=footSlidingDiagnostics({left:foot([0,.005,.012,.018]),right:[{time:0,x:0,z:0,planted:false},{time:1/60,x:.2,z:0,planted:false}]});assert.equal(qa.failed,0);assert.equal(qa.warnings,0);assert.ok(qa.worst.maxDisplacement<.02);assert.equal(qa.visualApprovalRequired,true);});
test('foot sliding flags warning and fail candidate thresholds',()=>{const qa=footSlidingDiagnostics({left:foot([0,.01,.03]),right:foot([0,.02,.06])});assert.equal(qa.warnings,1);assert.equal(qa.failed,1);assert.equal(qa.pass,false);assert.equal(qa.worst.side,'right');});
test('jerk QA accepts smooth constant velocity',()=>{const samples=Array.from({length:6},(_,i)=>({time:i*.1,position:[i*.1,0,0],rotation:[0,i*.02,0]}));const qa=motionJerkDiagnostics({hips:samples});assert.equal(qa.pass,true);assert.equal(qa.spikes.length,0);});
test('jerk QA catches abrupt linear and angular changes',()=>{const samples=[0,1,2,8,9,10].map((x,i)=>({time:i*.1,position:[x,0,0],rotation:[0,i<3?0:2,0]}));const qa=motionJerkDiagnostics({weaponTip:samples},{linearWarning:100,angularWarning:100});assert.equal(qa.pass,false);assert.ok(qa.spikes.some(s=>s.kind==='linear'));assert.ok(qa.spikes.some(s=>s.kind==='angular'));});
test('combined kinematics evidence cannot grant visual approval',()=>{const smooth=Array.from({length:6},(_,i)=>({time:i*.1,position:[i*.1,0,0],rotation:[0,0,0]})),evidence=createMotionKinematicsEvidence({feet:{left:foot([0,.001,.002,.003]),right:foot([0,.001,.002,.003])},tracks:{hips:smooth}});assert.equal(evidence.diagnosticPass,true);assert.equal(evidence.visualApprovalRequired,true);});
