import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newState, conflictScope } from '../scripts/integration-rescue-policy.mjs';
import { rescueView } from '../ops-board/rescue.mjs';
import { workRepairEligibility, claimWorkRepair, stopWorkRepair, stopWorkRepairForDevelopAdvance } from '../scripts/integration-rescue-work-repair.mjs';

const source='1'.repeat(40), base='2'.repeat(40), now=1800000000000;
function repairFixture(){
  const state=newState();
  const pr={number:162,state:'open',draft:false,author_association:'OWNER',title:'Feast growth',body:'Keep feast flow\nPreserve current develop\nDepends-On: none',labels:[],changed_files:1,head:{ref:'feat/demon-feast-growth',sha:source,repo:{full_name:'charukun/soul-lineage'}},base:{ref:'develop',repo:{full_name:'charukun/soul-lineage'}}};
  const evidence={pr,reviews:[],unresolved:false,complete:true,issues:[],files:[{filename:'apps/demon/src/web/main.js'}],filesComplete:true,develop:base,dependencies:[]};
  state.records[162]={pr:162,branch:pr.head.ref,headSha:source,state:'FAILED_MANUAL',failureReason:'FAILED_MANUAL:SEMANTIC_CONFLICT:apps/demon/src/web/main.js',attempt:3,maxAttempts:3,lease:null,scope:conflictScope(['apps/demon/src/web/main.js'])};
  return {state,evidence,r:state.records[162]};
}

test('develop advancement preserves semantic Work repair attempt and uses bounded churn budget',()=>{
  const f=repairFixture(), baselines=['3','4','5','6','7','8','9','a'].map(c=>c.repeat(40));
  claimWorkRepair(f.state,162,'work/churn',f.evidence,now);
  assert.equal(f.r.workRepairAttempts,1);
  for(let i=1;i<=baselines.length;i++){
    const next=baselines[i-1];
    const stopped=stopWorkRepairForDevelopAdvance(f.state,162,'work/churn',`Latest develop advanced from ${f.evidence.develop} to ${next}`,{now:now+i*100});
    assert.equal(stopped.attempt,1);
    assert.equal(f.r.workRepairAttempts,1);
    assert.equal(f.r.workRepairBaselineChurns,i);
    if(i<baselines.length){
      f.evidence.develop=next;
      const eligibility=workRepairEligibility(f.r);
      assert.equal(eligibility.eligible,true);
      assert.equal(eligibility.resumeBaseline,true);
      claimWorkRepair(f.state,162,'work/churn',f.evidence,now+i*100+1);
      assert.equal(f.r.workRepairAttempts,1);
      assert.equal(f.r.workRepair.attempt,1);
    }
  }
  const exhausted=workRepairEligibility(f.r);
  assert.equal(exhausted.eligible,false);
  assert.equal(exhausted.reason,'WORK_REPAIR_BASELINE_CHURN_EXHAUSTED');
});

test('existing stopWorkRepair API automatically treats develop advancement as baseline churn',()=>{
  const f=repairFixture(), next='a'.repeat(40);
  claimWorkRepair(f.state,162,'work/backward-compatible',f.evidence,now);
  const stopped=stopWorkRepair(f.state,162,'work/backward-compatible',`Latest develop advanced from ${base} to ${next} after trusted validation`,{humanRequired:false,now:now+1});
  assert.equal(stopped.attempt,1);
  assert.equal(f.r.workRepairAttempts,1);
  assert.equal(f.r.workRepairBaselineChurns,1);
  assert.equal(f.r.workRepair.status,'baseline-advanced');
  assert.equal(workRepairEligibility(f.r).resumeBaseline,true);
});

test('legacy capped record whose last Work stop was develop advancement is recoverable',()=>{
  const f=repairFixture();
  f.r.workRepairAttempts=2;
  f.r.workRepair={status:'failed',reason:`Latest develop advanced from ${base} to ${'a'.repeat(40)} after npm ci and trusted fast validation.`,expiresAt:new Date(now-1).toISOString()};
  const eligibility=workRepairEligibility(f.r);
  assert.equal(eligibility.eligible,true);
  assert.equal(eligibility.resumeBaseline,true);
  f.evidence.develop='a'.repeat(40);
  claimWorkRepair(f.state,162,'work/legacy-resume',f.evidence,now);
  assert.equal(f.r.workRepairAttempts,2);
  assert.equal(f.r.workRepair.attempt,2);
  assert.equal(f.r.workRepair.resumedFromBaselineAdvance,true);
});

test('real Work failures still consume the finite semantic retry budget',()=>{
  const f=repairFixture();
  claimWorkRepair(f.state,162,'work/fail',f.evidence,now);
  stopWorkRepair(f.state,162,'work/fail','Semantic reconciliation failed validation',{humanRequired:false,now:now+1});
  claimWorkRepair(f.state,162,'work/fail-2',f.evidence,now+2);
  stopWorkRepair(f.state,162,'work/fail-2','Semantic reconciliation failed validation again',{humanRequired:false,now:now+3});
  const eligibility=workRepairEligibility(f.r);
  assert.equal(eligibility.eligible,false);
  assert.equal(eligibility.reason,'WORK_REPAIR_ATTEMPTS_EXHAUSTED');
});

test('PULSE separates AI repairable manual stops from human decisions and policy holds',()=>{
  const state=newState(); state.coordinator={configured:true,phase:'observing',heartbeatAt:new Date(now).toISOString()}; state.updatedAt=new Date(now).toISOString();
  const scope=conflictScope(['apps/rinne/src/story/controller.js']);
  state.records[1]={pr:1,title:'recoverable',state:'FAILED_MANUAL',failureReason:'FAILED_MANUAL:SEMANTIC_CONFLICT:apps/rinne/src/story/controller.js',scope,attempt:1,maxAttempts:3,updatedAt:new Date(now).toISOString(),detectedAt:new Date(now).toISOString(),dependencies:[],blockedBy:[]};
  state.records[2]={pr:2,title:'human',state:'FAILED_MANUAL',failureReason:'FAILED_MANUAL:SEMANTIC_CONFLICT:apps/rinne/src/story/controller.js',workRepair:{status:'human-required',reason:'Product choice required'},scope,attempt:1,maxAttempts:3,updatedAt:new Date(now).toISOString(),detectedAt:new Date(now).toISOString(),dependencies:[],blockedBy:[]};
  state.records[3]={pr:3,title:'draft',state:'FAILED_MANUAL',failureReason:'DRAFT',scope,attempt:0,maxAttempts:3,updatedAt:new Date(now).toISOString(),detectedAt:new Date(now).toISOString(),dependencies:[],blockedBy:[]};
  const view=rescueView(state,now);
  assert.equal(view.counts.manual,3);
  assert.equal(view.counts.recoverableManual,1);
  assert.equal(view.counts.humanManual,1);
  assert.equal(view.counts.manualHold,1);
  assert.equal(view.counts.waiting,1);
  assert.equal(view.counts.attention,2);
  assert.equal(view.recoverableManual[0].manualKind,'work-recoverable');
  assert.equal(view.humanManual[0].manualKind,'human-required');
  assert.equal(view.manualHold[0].manualKind,'manual-hold');
  assert.equal(view.status,'ATTENTION');
});

test('PULSE uses the pure repair policy and names AI repair waiting separately from human decisions',()=>{
  const source=readFileSync('ops-board/public/rescue-board.js','utf8');
  const backend=readFileSync('ops-board/rescue.mjs','utf8');
  assert.match(source,/AI修復待ち/);
  assert.match(source,/人の判断が必要/);
  assert.match(source,/baseline churn/);
  assert.doesNotMatch(source,/FAILED_MANUAL: '人の確認が必要'/);
  assert.match(backend,/integration-rescue-work-repair-policy\.mjs/);
  assert.doesNotMatch(backend,/integration-rescue-work-repair\.mjs/);
});
