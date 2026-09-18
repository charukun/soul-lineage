import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeMotionRepair,compareMotionRepairEvidence,createMotionRepairDispatch} from '../src/index.js';

const plan=(kind='foot-slide',detail={failed:1,warnings:0})=>({schema:'motion-review-plan',version:1,revision:'before-rev',visualApprovalRequired:true,autoEditAllowed:false,autoApproveAllowed:false,tasks:[{kind,priority:5,detail}],next:{kind,priority:5,detail}});

test('safe diagnostic produces one bounded parameter repair without gameplay authority',()=>{
 const proposal=proposeMotionRepair(plan(),{parameterSnapshot:{footLockDamping:.8}});
 assert.equal(proposal.action,'parameter-repair');assert.equal(proposal.change.parameter,'footLockDamping');assert.equal(proposal.change.before,.8);assert.equal(proposal.change.after,.84);assert.equal(proposal.mayEditGameplay,false);assert.equal(proposal.mayChangeContactTiming,false);assert.equal(proposal.autoApproveAllowed,false);
});

test('unsafe artistic regression stays human review',()=>{
 const proposal=proposeMotionRepair(plan('frame-regression',{failed:2}),{parameterSnapshot:{}});
 assert.equal(proposal.action,'human-review');assert.equal(proposal.visualApprovalRequired,true);assert.equal(proposal.autoApproveAllowed,false);
});

test('repair dispatch requires deterministic recapture improvement and remains Draft',()=>{
 const proposal=proposeMotionRepair(plan(),{parameterSnapshot:{footLockDamping:.8}}),before={footSliding:{failed:1,warnings:1,worst:{maxDisplacement:.07}}},after={footSliding:{failed:0,warnings:0,worst:{maxDisplacement:.01}}};
 const comparison=compareMotionRepairEvidence(before,after);assert.equal(comparison.improved,true);
 const dispatch=createMotionRepairDispatch({proposal,beforeEvidence:before,afterEvidence:after,sourceRevision:'before-rev',afterRevision:'after-rev'});
 assert.equal(dispatch.draft,true);assert.equal(dispatch.autoApproveAllowed,false);assert.equal(dispatch.requiresRecapture,true);assert.match(dispatch.branch,/^repair\/motion-foot-slide-/);assert.match(dispatch.request,/Preserve authored contact timing/);
 assert.throws(()=>createMotionRepairDispatch({proposal,beforeEvidence:after,afterEvidence:before,sourceRevision:'a',afterRevision:'b'}),/did not improve/);
});
