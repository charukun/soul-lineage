import test from 'node:test';
import assert from 'node:assert/strict';
import {createQAReport,attachMotionKinematicsQA,attachMotionDeviceCalibration,serializeQAReport,deserializeQAReport} from '../src/motion-qa.js';
import {createMotionKinematicsEvidence} from '../src/motion-kinematics-qa.js';
import {createMotionDeviceCalibration} from '../src/motion-operationalization.js';

const review={fps:60,sequence:'operational-review',characters:['SHINO'],viewport:[390,844],dpr:2,lighting:'qa-neutral',motionRevision:'motion-operational-1'};
const foot=xs=>xs.map((x,i)=>({time:i/60,x,z:0,planted:true}));
const smooth=Array.from({length:6},(_,i)=>({time:i*.1,position:[i*.1,0,0],rotation:[0,0,0]}));

test('kinematics evidence attaches without changing visual approval',()=>{const report=createQAReport({build:'test',reviewer:'worker',review}),evidence=createMotionKinematicsEvidence({feet:{left:foot([0,.001,.002,.003]),right:foot([0,.001,.002,.003])},tracks:{hips:smooth}}),next=attachMotionKinematicsQA(report,evidence);assert.equal(next.visualApproval,'pending');assert.equal(next.motionKinematics.visualApprovalRequired,true);});
test('design device evidence never becomes measured hardware or visual approval',()=>{const report=createQAReport({build:'test',reviewer:'worker',review}),evidence=createMotionDeviceCalibration({deviceClass:'pixel-fold-class-30',physicalDevice:false,cohort:12,sampleCount:120,totalMeanMs:4.8,layers:[{layer:'base-motion',meanMs:3.1,maxMs:5.2}]}),next=attachMotionDeviceCalibration(report,evidence);assert.equal(next.deviceCalibration.measuredHardware,false);assert.equal(next.deviceCalibration.designBudgetIsMeasurement,false);assert.equal(next.visualApproval,'pending');});
test('physical calibration survives serialization only with explicit physical evidence fields',()=>{let report=createQAReport({build:'test',reviewer:'worker',review});const evidence=createMotionDeviceCalibration({deviceClass:'Pixel Fold',physicalDevice:true,userAgent:'Android Pixel Fold',refreshHz:60,cohort:12,sampleCount:300,totalMeanMs:4.9,layers:[{layer:'base-motion',meanMs:3,maxMs:5},{layer:'selection',meanMs:.8,maxMs:1.4}]});report=attachMotionDeviceCalibration(report,evidence);const decoded=deserializeQAReport(serializeQAReport(report));assert.equal(decoded.deviceCalibration.measuredHardware,true);assert.equal(decoded.visualApproval,'pending');});
