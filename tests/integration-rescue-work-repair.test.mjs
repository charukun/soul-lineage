import {rescueView} from '../ops-board/rescue.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, conflictScope, planWave } from '../scripts/integration-rescue-policy.mjs';
import { workRepairClass,workRepairEligibility,verifyWorkRepair,claimWorkRepair,heartbeatWorkRepair,expireWorkRepair,prepareWorkRepairPush,finishWorkRepair,recoverWorkRepair,stopWorkRepair } from '../scripts/integration-rescue-work-repair.mjs';
const old='1'.repeat(40),base='2'.repeat(40),head='3'.repeat(40),tree='4'.repeat(40),now=1800000000000,worker='work/test-run';
function fixture(){
 const state=newState();
 const pr={number:121,state:'open',draft:false,author_association:'OWNER',title:'Fix hunt',body:'Repair hunt\nRetain both changes\nDepends-On: none',labels:[],changed_files:1,head:{ref:'feat/hunt',sha:old,repo:{full_name:'charukun/soul-lineage'}},base:{ref:'develop',repo:{full_name:'charukun/soul-lineage'}}};
 const evidence={pr,reviews:[],unresolved:false,complete:true,issues:[],files:[{filename:'apps/demon/src/web/main.js'}],filesComplete:true,develop:base,dependencies:[]};
 state.records[121]={pr:121,branch:pr.head.ref,headSha:old,state:'FAILED_MANUAL',failureReason:'FAILED_MANUAL:SEMANTIC_CONFLICT:apps/demon/src/web/main.js',attempt:1,maxAttempts:3,lease:null,scope:conflictScope(evidence.files.map(f=>f.filename)),failures:[{reason:'prior attempt'}]};
 const result={head,tree,commit:{sha:head,tree:{sha:tree},parents:[{sha:old},{sha:base}]},changedPaths:['apps/demon/src/web/main.js'],changedPathsComplete:true,validation:{status:'passed',tree,command:'node scripts/validate.mjs fast origin/develop HEAD'},decision:{preservesBoth:true,summary:'Keep lineage and current controls',sources:[{path:'PR diff',commit:old},{path:'docs/spec.md',commit:base}]}};
 return {state,evidence,result,r:state.records[121]};
}
test('manual conflict is repaired through CAS operations then returned only after observed push',()=>{
 const {state,evidence,result,r}=fixture();claimWorkRepair(state,121,worker,evidence,now);
 assert.equal(r.attempt,1);assert.equal(r.workRepairAttempts,1);assert.equal(r.state,'FAILED_MANUAL');assert.equal(r.lease,null);
 assert.deepEqual(prepareWorkRepairPush(state,121,worker,evidence,result,now+1),{branch:'feat/hunt',sha:head,force:false});
 assert.throws(()=>finishWorkRepair(state,121,worker,evidence,now+2),/PUSH_NOT_OBSERVED/);
 evidence.pr.head.sha=head;finishWorkRepair(state,121,worker,evidence,now+3);
 assert.equal(r.state,'RETURNED_TO_INTEGRATION');assert.equal(r.pushedSha,head);assert.equal(r.workRepair.status,'returned');assert.equal(r.pendingIntegration,true);
 assert.equal(r.failures[0].reason,'prior attempt');assert.equal(r.validation.status,'passed');
});
test('all repairable manual classes are routed to Work',()=>{
 const cases=[
  ['semantic','FAILED_MANUAL:SEMANTIC_CONFLICT:apps/rinne/src/a.js'],
  ['overlap','FAILED_MANUAL:OVERLAPPING_CHANGES:AGENTS.md'],
  ['related','FAILED_MANUAL:RELATED_CODE_RECONCILIATION'],
  ['control','FAILED_MANUAL:CONTROL_OR_CONTRACT_RECONCILIATION'],
  ['transport','GitHub POST /repos/charukun/soul-lineage/git/trees: HTTP 422'],
 ];
 for(const [kind,reason] of cases){const f=fixture();f.r.failureReason=reason;assert.equal(workRepairClass(f.r),kind);assert.equal(workRepairEligibility(f.r).eligible,true);}
});
for(const [name,change]of [
 ['hold',f=>f.evidence.pr.labels=[{name:'integration:hold'}]],
 ['review',f=>f.evidence.reviews=[{state:'CHANGES_REQUESTED',user:{login:'reviewer'},submitted_at:'2026-09-13T00:00:00Z',commit_id:old}]],
 ['thread',f=>f.evidence.unresolved=true],['missing reviews',f=>delete f.evidence.reviews],['draft',f=>f.evidence.pr.draft=true],
 ['external',f=>f.evidence.pr.head.repo.full_name='someone/fork'],['protected',f=>f.evidence.pr.head.ref='develop'],
 ['unknown files',f=>f.evidence.filesComplete=false],['new head',f=>f.evidence.pr.head.sha=head],
 ['manual decision',f=>f.r.failureReason='DEPENDENCY_CYCLE'],['Work repair cap',f=>f.r.workRepairAttempts=2],['Actions ownership',f=>f.r.lease='actions-lease'],
 ['contract',f=>f.evidence.files=[{filename:'packages/raid/save-format.js'}]],
 ['dependency',f=>f.evidence.pr.body='Depends-On: #90'],
 ['browser repair',f=>f.evidence.issues=[{number:9,body:'<!-- browser-repair:v1\n'+JSON.stringify({schema:1,sourcePr:121,state:'working'})+'\n-->'}]],
 ])test(`automatic Work repair refuses ${name}`,()=>{const f=fixture();change(f);assert.throws(()=>verifyWorkRepair(f.r,f.evidence));});
test('Actions retry exhaustion does not suppress the bounded Work escalation lane',()=>{
 const f=fixture();f.r.attempt=f.r.maxAttempts;assert.equal(workRepairEligibility(f.r).eligible,true);claimWorkRepair(f.state,121,worker,f.evidence,now);assert.equal(f.r.attempt,3);assert.equal(f.r.workRepairAttempts,1);
});
test('control-plane reconciliation requires explicit gate-preservation evidence',()=>{
 const f=fixture();f.evidence.files=[{filename:'AGENTS.md'}];f.r.scope=conflictScope(['AGENTS.md']);f.result.changedPaths=['AGENTS.md'];
 claimWorkRepair(f.state,121,worker,f.evidence,now);
 assert.throws(()=>prepareWorkRepairPush(f.state,121,worker,f.evidence,f.result,now+1),/CONTROL_GATES_NOT_PROVEN/);
 f.result.decision.controlReview={preservesGates:true,governingSources:['AGENTS.md','docs/DEVELOPMENT.md','docs/INTEGRATION.md']};
 assert.deepEqual(prepareWorkRepairPush(f.state,121,worker,f.evidence,f.result,now+2),{branch:'feat/hunt',sha:head,force:false});
});
test('one worker owns the reservation; stale worker cannot push after another claim',()=>{
 const f=fixture();claimWorkRepair(f.state,121,worker,f.evidence,now);
 assert.throws(()=>claimWorkRepair(f.state,121,'work/other',f.evidence,now+1),/ALREADY_CLAIMED/);
 const later=now+46*60000;claimWorkRepair(f.state,121,'work/other',f.evidence,later);
 assert.equal(f.r.workRepairAttempts,2);assert.throws(()=>prepareWorkRepairPush(f.state,121,worker,f.evidence,f.result,later),/FENCED/);
 heartbeatWorkRepair(f.state,121,'work/other',later+1);
});
test('genuine unresolved semantics stop repeated automatic attempts',()=>{
 const f=fixture();claimWorkRepair(f.state,121,worker,f.evidence,now);
 stopWorkRepair(f.state,121,worker,'Two contradictory save contracts need a product decision',{now:now+1});
 assert.equal(f.r.workRepair.status,'human-required');assert.throws(()=>claimWorkRepair(f.state,121,worker,f.evidence,now+2),/HUMAN_DECISION/);
});
test('new head, changed develop, failed validation and scope expansion block a prepared push',()=>{
 for(const change of [f=>f.evidence.develop=head,f=>f.evidence.pr.body+='\nNew requirement',f=>f.result.validation.status='failed',f=>f.result.commit.tree.sha=old,f=>f.result.changedPaths=['scripts/integration.mjs'],f=>f.result.commit.parents.pop(),f=>f.result.decision.sources.pop()]){
  const f=fixture();claimWorkRepair(f.state,121,worker,f.evidence,now);change(f);
  assert.throws(()=>prepareWorkRepairPush(f.state,121,worker,f.evidence,f.result,now+1));
 }
});
test('interrupted completed push can be recorded without another ref mutation',()=>{
 const f=fixture();claimWorkRepair(f.state,121,worker,f.evidence,now);prepareWorkRepairPush(f.state,121,worker,f.evidence,f.result,now+1);
 f.evidence.pr.head.sha=head;
 assert.throws(()=>recoverWorkRepair(f.state,121,'work/recovery',f.evidence,now+2),/ALREADY_CLAIMED/);
 recoverWorkRepair(f.state,121,'work/recovery',f.evidence,now+46*60000);
 assert.equal(f.r.state,'RETURNED_TO_INTEGRATION');assert.equal(f.r.workRepairAttempts,1);
});
test('Work repairs participate in the existing Actions scope lock and concurrency limit',()=>{
 const f=fixture();claimWorkRepair(f.state,121,worker,f.evidence,now);
 f.state.records[122]={...structuredClone(f.r),pr:122,state:'DETECTED',workRepair:undefined,workRepairAttempts:0,attempt:0,dependencies:[],changes:10};
 assert.deepEqual(planWave(f.state,{runId:'run',id:'wave',now:now+1}),[]);
 assert.equal(f.state.records[122].state,'BLOCKED_BY_RESCUE');assert.deepEqual(f.state.records[122].blockedBy,[121]);
});
test('expired Work reservations release slots but keep their independent retry budget',()=>{
 const f=fixture();claimWorkRepair(f.state,121,worker,f.evidence,now);
 assert.equal(expireWorkRepair(f.state,121,now+1),false);
 assert.equal(expireWorkRepair(f.state,121,now+46*60000),true);
 assert.equal(f.r.workRepair.status,'expired');
 claimWorkRepair(f.state,121,'work/retry',f.evidence,now+46*60000+1);assert.equal(f.r.workRepairAttempts,2);
 assert.throws(()=>claimWorkRepair(f.state,121,'work/third',f.evidence,now+92*60000+2),/WORK_REPAIR_ATTEMPTS_EXHAUSTED/);
});
test('PULSE shows the real Work owner and counts only observed validated repairs',()=>{
 const f=fixture();f.r.rescueId='original-actions-attempt';claimWorkRepair(f.state,121,worker,f.evidence,now);
 let view=rescueView(f.state,now+1);assert.equal(view.counts.active,1);assert.equal(view.counts.manual,0);assert.equal(view.workers[0].workerId,worker);assert.equal(view.workers[0].sourceState,'FAILED_MANUAL');assert.equal(view.throughput.rescued,0);
 prepareWorkRepairPush(f.state,121,worker,f.evidence,f.result,now+2);f.evidence.pr.head.sha=head;finishWorkRepair(f.state,121,worker,f.evidence,now+3);
 view=rescueView(f.state,now+4);assert.equal(view.counts.active,0);assert.equal(view.recent[0].repairVerified,true);assert.equal(view.throughput.rescued,1);
 f.r.workRepair.result.validation.status='failed';assert.equal(rescueView(f.state,now+4).throughput.rescued,0);
});
