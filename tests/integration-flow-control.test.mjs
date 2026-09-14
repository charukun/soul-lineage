import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conflictScope, newState } from '../scripts/integration-rescue-policy.mjs';
import { flowPressure, planIntegrationTrain, deliveryLatencyMetrics, compactRescueState, staleReadyCandidate } from '../scripts/integration-flow-control.mjs';
import { prioritizeReturnedReady } from '../scripts/integration-rescue-priority.mjs';

const now=Date.parse('2026-09-14T07:30:00Z');
const pr=(number,created,labels=[],branch=`feat/p${number}`)=>({number,created_at:new Date(created).toISOString(),updated_at:new Date(created).toISOString(),title:`PR ${number}`,body:'Depends-On: none',labels:labels.map(name=>({name})),head:{ref:branch,sha:String(number).padStart(40,'a')}});

test('queue pressure enters BUSY and BURN_DOWN at bounded thresholds',()=>{
  assert.equal(flowPressure({ready:4}).mode,'NORMAL');
  assert.equal(flowPressure({ready:5}).mode,'BUSY');
  assert.equal(flowPressure({ready:9,recoverableManual:1}).mode,'BURN_DOWN');
  assert.equal(flowPressure({ready:10}).pauseMaintenance,true);
});

test('Integration Train selects only GREEN-independent scopes',()=>{
  const items=[{number:1},{number:2},{number:3},{number:4}];
  const scopes=new Map([
    [1,conflictScope(['apps/rinne/src/a.js'])],
    [2,conflictScope(['apps/village/src/a.js'])],
    [3,conflictScope(['apps/rinne/src/b.js'])],
    [4,conflictScope(['packages/rendering/src/a.js'])],
  ]);
  const result=planIntegrationTrain(items,scopes,{max:5});
  assert.deepEqual(result.selected.map(x=>x.number),[1,2,4]);
  assert.deepEqual(result.deferred.map(x=>x.number),[3]);
});

test('repair/returned heads stay ahead while pressure train reorders ordinary work',()=>{
  const items=[pr(1,now-5*3600000,['integration:repair']),pr(2,now-20*3600000),pr(3,now-10*3600000),pr(4,now-8*3600000),pr(5,now-7*3600000),pr(6,now-6*3600000)];
  const returned=new Map(); returned.scopeByPr=new Map([
    [2,conflictScope(['apps/rinne/src/a.js'])],[3,conflictScope(['apps/rinne/src/b.js'])],[4,conflictScope(['apps/village/src/a.js'])],[5,conflictScope(['apps/demon/src/a.js'])],[6,conflictScope(['packages/rendering/src/a.js'])],
  ]);
  returned.set(3,items[2].head.sha);
  const ordered=prioritizeReturnedReady(items,returned,now);
  assert.equal(ordered[0].number,3,'returned Rescue head stays first');
  assert.equal(ordered[1].number,1,'repair stays ahead of ordinary train');
  assert.equal(ordered.flowControl.mode,'BUSY');
  assert.ok(ordered.flowControl.train.length>0);
});

test('delivery latency reports p50/p95 from Ready detection through merge and DEV',()=>{
  const records=[
    {detectedAt:new Date(now-20*60000).toISOString(),mergedAt:new Date(now-15*60000).toISOString(),devAt:new Date(now-10*60000).toISOString()},
    {detectedAt:new Date(now-40*60000).toISOString(),mergedAt:new Date(now-25*60000).toISOString(),devAt:new Date(now-5*60000).toISOString()},
  ];
  const m=deliveryLatencyMetrics(records);
  assert.equal(m.readyToMerge.samples,2);assert.equal(m.readyToMerge.p50Ms,5*60000);assert.equal(m.readyToMerge.p95Ms,15*60000);
  assert.equal(m.mergeToDev.p95Ms,20*60000);assert.equal(m.readyToDev.p95Ms,35*60000);
});

test('state compaction archives only old terminal records and keeps active/manual recovery evidence',()=>{
  const s=newState();
  s.records[1]={pr:1,state:'DEV',updatedAt:new Date(now-49*3600000).toISOString()};
  s.records[2]={pr:2,state:'MERGED',updatedAt:new Date(now-1*3600000).toISOString()};
  s.records[3]={pr:3,state:'FAILED_MANUAL',updatedAt:new Date(now-100*3600000).toISOString(),failureReason:'FAILED_MANUAL:SEMANTIC_CONFLICT:x'};
  s.records[4]={pr:4,state:'QUEUED',updatedAt:new Date(now-100*3600000).toISOString()};
  compactRescueState(s,now);
  assert.equal(s.records[1],undefined);assert.ok(s.records[2]);assert.ok(s.records[3]);assert.ok(s.records[4]);
  assert.equal(s.history.archivedTerminal,1);assert.equal(s.history.byState.DEV,1);
});

test('stale Ready classifier is bounded and excludes Draft/closed PRs',()=>{
  assert.equal(staleReadyCandidate({state:'open',draft:false,created_at:new Date(now-73*3600000).toISOString()},now),true);
  assert.equal(staleReadyCandidate({state:'open',draft:true,created_at:new Date(now-100*3600000).toISOString()},now),false);
  assert.equal(staleReadyCandidate({state:'closed',draft:false,created_at:new Date(now-100*3600000).toISOString()},now),false);
});

test('workflow contracts coalesce CI and pause Code Health PR creation under pressure',()=>{
  const ci=readFileSync('.github/workflows/ci.yml','utf8');
  const health=readFileSync('.github/workflows/code-health.yml','utf8');
  assert.match(ci,/group: ci-\$\{\{ github\.event\.pull_request\.number \}\}-/);
  assert.match(ci,/cancel-in-progress: true/);
  assert.match(health,/Measure Integration backlog pressure/);
  assert.match(health,/steps\.pressure\.outputs\.pause != 'true'/);
});

test('AI-repair signal and PULSE latency surface are wired without weakening gates',()=>{
  const returns=readFileSync('scripts/integration-rescue-return.mjs','utf8');
  const flow=readFileSync('ops-board/public/flow-board.js','utf8');
  const index=readFileSync('ops-board/public/index.html','utf8');
  assert.match(returns,/AI_REPAIR_REQUIRED/);assert.match(returns,/integration-rescue\/work-repair/);assert.match(returns,/workRepairEligibility/);
  assert.match(flow,/Ready→Merge/);assert.match(flow,/Merge→DEV/);assert.match(flow,/Ready→DEV/);assert.doesNotMatch(flow,/innerHTML/);
  assert.match(index,/id="integration-flow"/);assert.match(index,/src="\.\/flow-board\.js"/);
});
