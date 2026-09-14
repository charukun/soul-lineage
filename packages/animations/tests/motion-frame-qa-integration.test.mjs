import test from 'node:test';
import assert from 'node:assert/strict';
import {createQAReport,attachFrameComparisonQA,serializeQAReport,deserializeQAReport,validateFrameComparisons} from '../src/motion-qa.js';
import {compareRgbaFrames,compareLandmarkFrames,createFrameComparisonEvidence} from '../src/motion-frame-qa.js';

const review={fps:60,sequence:'interaction review',characters:['SHINO'],viewport:[390,844],dpr:2,lighting:'qa-neutral',motionRevision:'motion-interaction-1'};
function evidence(){const rgba=compareRgbaFrames(new Uint8Array(16),new Uint8Array(16)),landmarks=compareLandmarkFrames({root:[0,0,0],joints:[[0,1,0]],weaponTip:[0,1,0]},{root:[0,0,0],joints:[[0,1,0]],weaponTip:[0,1,0]});return createFrameComparisonEvidence({camera:'front',frame:120,beforeRevision:'old',afterRevision:'motion-interaction-1',rgba,landmarks});}

test('frame evidence attaches to QA v1 without changing visual approval',()=>{const report=createQAReport({build:'test',reviewer:'worker',review}),next=attachFrameComparisonQA(report,[evidence()]);assert.equal(next.version,1);assert.equal(next.visualApproval,'pending');assert.equal(next.frameComparisons.length,1);assert.equal(report.frameComparisons,undefined);});

test('frame evidence survives existing report serialization',()=>{const next=attachFrameComparisonQA(createQAReport({build:'test',reviewer:'worker',review}),[evidence()]),decoded=deserializeQAReport(serializeQAReport(next));assert.equal(decoded.frameComparisons[0].visualApprovalRequired,true);assert.equal(decoded.visualApproval,'pending');});

test('frame evidence validation fails closed on malformed/auto-approval data',()=>{const bad={...evidence(),visualApprovalRequired:false};assert.throws(()=>validateFrameComparisons([bad]));assert.throws(()=>validateFrameComparisons([]));});
