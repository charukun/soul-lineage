import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRgbaFrames,compareLandmarkFrames,createFrameComparisonEvidence,summarizeFrameComparisons} from '../src/motion-frame-qa.js';

test('RGBA comparison passes identical frames and catches localized regression',()=>{
 const a=new Uint8ClampedArray(4*100);a.fill(20);const same=compareRgbaFrames(a,new Uint8ClampedArray(a));assert.equal(same.pass,true);assert.equal(same.changedPixels,0);
 const b=new Uint8ClampedArray(a);for(let i=0;i<10;i++){b[i*4]=255;b[i*4+1]=255;b[i*4+2]=255;}const changed=compareRgbaFrames(a,b,{channelThreshold:18,maxChangedRatio:.05});assert.equal(changed.pass,false);assert.ok(changed.changedRatio>=.1);
});

test('landmark comparison tracks root joints and weapon independently',()=>{
 const before={root:[0,0,0],joints:[[0,1,0],[.2,1.2,0]],weaponTip:[.5,1,.2]},after={root:[.02,0,0],joints:[[0,1.02,0],[.22,1.2,0]],weaponTip:[.55,1,.2]};const pass=compareLandmarkFrames(before,after);assert.equal(pass.pass,true);
 const fail=compareLandmarkFrames(before,{...after,weaponTip:[1.2,1,.2]});assert.equal(fail.pass,false);assert.ok(fail.weapon>.16);
});

test('frame evidence stays diagnostic and summary never claims visual approval',()=>{
 const rgba=compareRgbaFrames(new Uint8Array(16),new Uint8Array(16)),landmarks=compareLandmarkFrames({root:[0,0,0],joints:[[0,1,0]],weaponTip:[0,1,0]},{root:[0,0,0],joints:[[0,1,0]],weaponTip:[0,1,0]});const evidence=createFrameComparisonEvidence({camera:'front',frame:120,beforeRevision:'old',afterRevision:'new',rgba,landmarks});assert.equal(evidence.visualApprovalRequired,true);const summary=summarizeFrameComparisons([evidence]);assert.equal(summary.diagnosticPass,true);assert.equal(summary.visualApprovalRequired,true);
});
