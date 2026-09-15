import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachMotionReferenceBenchmark,
  attachMotionDeviceCalibration,
  createMotionDeviceCalibration,
  createQAReport,
  deserializeQAReport,
  evaluateMotionReferenceBenchmark,
  getMotionReference,
  serializeQAReport,
  validateMotionReferenceBenchmark
} from '../src/index.js';

const passingInput=()=>({
  locomotion:{actualSpeed:4,authoredSpeed:2,playbackRate:2,masterPhase:.98,followerPhase:.01,phaseTolerance:.04,playbackTolerance:.05},
  rootMotion:{transformAuthority:'controller',horizontalMode:'extracted',replayAuthority:'controller'},
  attack:{duration:.8,turnEnd:.18,warpStart:.2,contact:.62,recovery:.86,warp:{targetLocked:true,requestedDistance:1.2,maxDistance:1.5,transformWriter:'controller',clock:'action'}},
  impact:{hitStopSeconds:.08,worldTimeScale:.15,cameraImpulse:true,hitReaction:true,cameraClock:'real'}
});

test('primary reference is pinned and a complete matching technique set passes',()=>{
  const reference=getMotionReference();
  assert.equal(reference.revision,'814a5631aaff1fdb0623be8e1e9356fefe772b43');
  assert.equal(reference.license,'MIT');
  assert.ok(reference.evidence.includes('src/animation/Attack.js'));
  const result=evaluateMotionReferenceBenchmark(passingInput());
  assert.equal(result.result,'pass');
  assert.ok(result.criteria.every(row=>row.status==='pass'));
  assert.equal(result.visualApprovalRequired,true);
});

test('benchmark reports actionable gaps without collapsing them into an aesthetic score',()=>{
  const input=passingInput();
  input.locomotion.followerPhase=.3;
  input.locomotion.playbackRate=.6;
  input.rootMotion={transformAuthority:'action',horizontalMode:'clip-applied',replayAuthority:'none'};
  input.attack.turnEnd=.5;
  input.attack.warpStart=.1;
  input.attack.warp={targetLocked:false,requestedDistance:2,maxDistance:1,transformWriter:'attack',clock:'parallel'};
  input.impact={hitStopSeconds:0,worldTimeScale:1,cameraImpulse:false,hitReaction:false,cameraClock:'scaled'};
  const result=evaluateMotionReferenceBenchmark(input);
  assert.equal(result.result,'gaps');
  assert.equal(Object.hasOwn(result,'score'),false);
  assert.deepEqual(result.criteria.filter(row=>row.status==='gap').map(row=>row.id),[
    'locomotion.phase-sync','locomotion.speed-match','root-motion.single-authority','attack.phase-order','attack.motion-warp','impact.single-beat'
  ]);
  assert.ok(result.criteria.every(row=>row.status==='pass'||typeof row.gap==='string'));
});

test('benchmark rejects non-finite, impossible and ambiguous evidence',()=>{
  assert.throws(()=>evaluateMotionReferenceBenchmark({...passingInput(),locomotion:{...passingInput().locomotion,actualSpeed:NaN}}));
  assert.throws(()=>evaluateMotionReferenceBenchmark({...passingInput(),rootMotion:{transformAuthority:'controller',horizontalMode:'frozen',replayAuthority:'controller'}}));
  assert.throws(()=>evaluateMotionReferenceBenchmark({...passingInput(),attack:{...passingInput().attack,contact:.9,recovery:.8}}));
  assert.throws(()=>evaluateMotionReferenceBenchmark({...passingInput(),attack:{...passingInput().attack,warp:{...passingInput().attack.warp,clock:'unknown'}}}));
});

test('benchmark output is deterministic and rejects tampered derived evidence',()=>{
  const first=evaluateMotionReferenceBenchmark(passingInput()),second=evaluateMotionReferenceBenchmark(passingInput());
  assert.deepEqual(first,second);
  assert.equal(validateMotionReferenceBenchmark(first),first);
  const tampered=structuredClone(first);tampered.criteria[0].status='gap';
  assert.throws(()=>validateMotionReferenceBenchmark(tampered));
});

test('optional benchmark evidence round trips through v1 QA without changing visual approval',()=>{
  const report=createQAReport({review:{sequence:'benchmark',fps:60,viewport:[390,420],dpr:1,lighting:'fixed',motionRevision:'source1',characters:[]}});
  const benchmark=evaluateMotionReferenceBenchmark(passingInput());
  const attached=attachMotionReferenceBenchmark(report,benchmark);
  assert.equal(attached.visualApproval,'pending');
  assert.equal(report.review.motionReferenceBenchmark,undefined);
  assert.equal(attached.review.motionReferenceBenchmark.result,'pass');
  assert.deepEqual(deserializeQAReport(serializeQAReport(attached)),attached);
  const tampered=structuredClone(benchmark);tampered.result='gaps';
  assert.throws(()=>attachMotionReferenceBenchmark(report,tampered));
});

test('reference and device evidence coexist without approving visuals or inventing hardware measurements',()=>{
  const report=createQAReport({review:{sequence:'combined-evidence',fps:60,viewport:[390,420],dpr:1,lighting:'fixed',motionRevision:'source1',characters:[]}});
  report.visualApproval='changes-requested';
  const benchmark=evaluateMotionReferenceBenchmark(passingInput());
  const device=createMotionDeviceCalibration({deviceClass:'pixel-fold-class-30',physicalDevice:false,cohort:12,sampleCount:0,layers:[]});
  const referenceFirst=attachMotionDeviceCalibration(attachMotionReferenceBenchmark(report,benchmark),device);
  const deviceFirst=attachMotionReferenceBenchmark(attachMotionDeviceCalibration(report,device),benchmark);
  assert.deepEqual(referenceFirst,deviceFirst);
  const decoded=deserializeQAReport(serializeQAReport(referenceFirst));
  assert.equal(decoded.visualApproval,'changes-requested');
  assert.equal(decoded.review.motionReferenceBenchmark.visualApprovalRequired,true);
  assert.equal(decoded.deviceCalibration.measuredHardware,false);
  assert.equal(report.review.motionReferenceBenchmark,undefined);
  assert.equal(report.deviceCalibration,undefined);
  const tampered=structuredClone(decoded);tampered.deviceCalibration.measuredHardware=true;
  assert.throws(()=>serializeQAReport(tampered),/Invalid measured motion device calibration/);
});
