import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conflictScope, newState } from '../scripts/integration-rescue-policy.mjs';
import {
  adaptiveFlowTuning,
  compactRescueState,
  contentSupersessionProof,
  criticalPathOrder,
  deliveryLatencyMetrics,
  dependencyGraph,
  flowPressure,
  planIntegrationTrain,
  quarantineDecision,
  staleReadyCandidate,
} from '../scripts/integration-flow-control.mjs';
import { rescueRuntimeAudit } from '../scripts/integration-queue-recovery.mjs';
import { prioritizeReturnedReady } from '../scripts/integration-rescue-priority.mjs';

const now = Date.parse('2026-09-14T07:30:00Z');
const pr = (number, created, labels = [], branch = `feat/p${number}`, body = 'Depends-On: none') => ({
  number, state:'open', draft:false, created_at:new Date(created).toISOString(), updated_at:new Date(created).toISOString(),
  title:`PR ${number}`, body, labels:labels.map(name=>({name})), head:{ref:branch,sha:String(number).padStart(40,'a')},
});

test('queue pressure enters BUSY and BURN_DOWN at bounded thresholds', () => {
  assert.equal(flowPressure({ready:4}).mode,'NORMAL');
  assert.equal(flowPressure({ready:5}).mode,'BUSY');
  assert.equal(flowPressure({ready:9,recoverableManual:1}).mode,'BURN_DOWN');
  assert.equal(flowPressure({ready:10}).pauseMaintenance,true);
});

test('critical path ranks a dependency root by transitive unblock count', () => {
  const items=[pr(1,now-1),pr(2,now-2,[],undefined,'Depends-On: #1'),pr(3,now-3,[],undefined,'Depends-On: #2'),pr(4,now-100)];
  const graph=dependencyGraph(items);
  assert.equal(graph.unblockCount.get(1),2);
  assert.equal(graph.unblockCount.get(2),1);
  assert.deepEqual(criticalPathOrder(items).slice(0,3).map(item=>item.number),[1,2,4]);
});

test('Integration Train selects GREEN scopes but permits declared predecessor ordering', () => {
  const items=[pr(1,now-10),pr(2,now-9,[],undefined,'Depends-On: #1'),pr(3,now-8),pr(4,now-7)];
  const scopes=new Map([[1,conflictScope(['apps/rinne/src/a.js'])],[2,conflictScope(['apps/rinne/src/a.js'])],[3,conflictScope(['apps/village/src/a.js'])],[4,conflictScope(['apps/rinne/src/b.js'])]]);
  const result=planIntegrationTrain(items,scopes,{max:5});
  assert.deepEqual(result.selected.map(item=>item.number),[1,2,3]);
  assert.deepEqual(result.deferred.map(item=>item.number),[4]);
});

test('repair/returned and validated virtual-train exact heads stay ahead of ordinary work', () => {
  const items=[pr(1,now-5*3600000,['integration:repair']),pr(2,now-20*3600000),pr(3,now-10*3600000),pr(4,now-8*3600000),pr(5,now-7*3600000),pr(6,now-6*3600000)];
  const returned=new Map();
  returned.scopeByPr=new Map(items.slice(1).map((item,index)=>[item.number,conflictScope([`apps/${['rinne','village','demon','lanternfell','character-studio'][index]}/src/a.js`])]));
  returned.quarantineHeads=new Map(); returned.latency=deliveryLatencyMetrics([]); returned.set(3,items[2].head.sha);
  returned.provenTrain={status:'validated',base:'b'.repeat(40),candidates:[{pr:4,head:items[3].head.sha},{pr:5,head:items[4].head.sha}]};
  const ordered=prioritizeReturnedReady(items,returned,now);
  assert.equal(ordered[0].number,3); assert.equal(ordered[1].number,1); assert.deepEqual(ordered.slice(2,4).map(item=>item.number),[4,5]);
  assert.deepEqual(ordered.flowControl.provenTrain,[4,5]);
});

test('a new head is not quarantined by failure evidence from the previous head', () => {
  const items=[pr(1,now-1000),pr(2,now-2000)];
  const returned=new Map(); returned.scopeByPr=new Map([[1,conflictScope(['apps/rinne/src/a.js'])],[2,conflictScope(['apps/village/src/a.js'])]]); returned.quarantineHeads=new Map([[2,'f'.repeat(40)]]); returned.latency=deliveryLatencyMetrics([]);
  const ordered=prioritizeReturnedReady(items,returned,now); assert.deepEqual(ordered.flowControl.quarantined,[]);
});

test('delivery latency includes Draft creation through Ready, Merge and DEV', () => {
  const records=[{implementationStartedAt:new Date(now-30*60000).toISOString(),readyAt:new Date(now-25*60000).toISOString(),mergedAt:new Date(now-15*60000).toISOString(),devAt:new Date(now-10*60000).toISOString()},{implementationStartedAt:new Date(now-60*60000).toISOString(),readyAt:new Date(now-50*60000).toISOString(),mergedAt:new Date(now-25*60000).toISOString(),devAt:new Date(now-5*60000).toISOString()}];
  const metrics=deliveryLatencyMetrics(records);
  assert.equal(metrics.implementationToReady.p95Ms,10*60000); assert.equal(metrics.readyToMerge.p95Ms,25*60000); assert.equal(metrics.mergeToDev.p95Ms,20*60000); assert.equal(metrics.implementationToDev.p95Ms,55*60000);
});

test('quarantine requires repeated meaningful failures and ignores observation churn', () => {
  const observation={reason:'HEAD_CHANGED',at:new Date(now).toISOString()};
  const failures=[observation,{reason:'VALIDATION_FAILED:unit',at:new Date(now).toISOString()},{reason:'Affected browser smoke failure',at:new Date(now).toISOString()},{reason:'GitHub POST /git/trees: HTTP 422',at:new Date(now).toISOString()}];
  assert.equal(quarantineDecision({state:'FAILED_RETRYABLE',failures}).quarantined,true);
  assert.equal(quarantineDecision({state:'FAILED_RETRYABLE',failures:[observation,observation,observation]}).quarantined,false);
  assert.equal(quarantineDecision({state:'DEV',failures}).quarantined,false);
});

test('adaptive tuning and runtime audit stay inside fixed safety bounds', () => {
  const low=adaptiveFlowTuning({ready:2,latency:deliveryLatencyMetrics([])}); assert.deepEqual([low.trainSize,low.rescueConcurrency,low.maxEvaluations],[3,4,16]);
  const high=adaptiveFlowTuning({ready:12,latency:{implementationToDev:{p95Ms:25*60000}},failureRate:0}); assert.deepEqual([high.trainSize,high.rescueConcurrency,high.maxEvaluations],[5,6,24]);
  const unstable=adaptiveFlowTuning({ready:20,failureRate:.3,rateRemaining:1000}); assert.deepEqual([unstable.trainSize,unstable.rescueConcurrency,unstable.maxEvaluations],[2,3,12]);
  const apiTight=adaptiveFlowTuning({ready:20,failureRate:0,rateRemaining:200}); assert.deepEqual([apiTight.trainSize,apiTight.rescueConcurrency,apiTight.maxEvaluations],[2,3,12]);
  const safe=newState(); safe.config.maxConcurrency=3; safe.config.maxEvaluations=12; safe.config.scanMinMs=60000; safe.config.queueStallMs=300000; safe.config.retryMs=120000; safe.coordinator={develop:'d'.repeat(40)};
  assert.equal(rescueRuntimeAudit(safe,'d'.repeat(40)).ok,true); safe.config.maxConcurrency=7; assert.equal(rescueRuntimeAudit(safe,'d'.repeat(40)).ok,false);
});

test('semantic supersession is exact leaf identity, not an AI similarity guess', () => {
  const paths=['a.js','b.css'],head=new Map([['a.js','100644:blob:aaa'],['b.css','100644:blob:bbb']]),develop=new Map(head);
  assert.deepEqual(contentSupersessionProof(paths,head,develop),{equivalent:true,reason:'EXACT_TOUCHED_CONTENT_MATCH'}); develop.set('b.css','100644:blob:ccc'); assert.equal(contentSupersessionProof(paths,head,develop).equivalent,false);
});

test('state compaction keeps MERGED, shrinks manual evidence and bounds delivery history', () => {
  const state=newState(); state.records[1]={pr:1,state:'DEV',updatedAt:new Date(now-49*3600000).toISOString()}; state.records[2]={pr:2,state:'MERGED',updatedAt:new Date(now-80*3600000).toISOString()}; state.records[3]={pr:3,state:'FAILED_MANUAL',updatedAt:new Date(now-100*3600000).toISOString(),failureReason:'FAILED_MANUAL:SEMANTIC_CONFLICT:x',baseChanges:['a','b','c']};
  state.flowControl={deliveries:{old:{pr:10,devAt:new Date(now-8*24*3600000).toISOString()},fresh:{pr:11,devAt:new Date(now-1*3600000).toISOString()}}}; compactRescueState(state,now);
  assert.equal(state.records[1],undefined); assert.ok(state.records[2]); assert.equal(state.records[3].baseChanges,undefined); assert.equal(state.records[3].baseChangeCount,3); assert.equal(state.flowControl.deliveries.old,undefined); assert.equal(state.flowControl.deliveries.fresh.pr,11);
});

test('stale Ready classifier is bounded and excludes Draft/closed PRs', () => {
  assert.equal(staleReadyCandidate({state:'open',draft:false,created_at:new Date(now-73*3600000).toISOString()},now),true);
  assert.equal(staleReadyCandidate({state:'open',draft:true,created_at:new Date(now-100*3600000).toISOString()},now),false);
  assert.equal(staleReadyCandidate({state:'closed',draft:false,created_at:new Date(now-100*3600000).toISOString()},now),false);
});

test('workflow contracts isolate Virtual Train and keep stack writes in trusted Return lane', () => {
  const rescue=readFileSync('.github/workflows/integration-rescue.yml','utf8'),queue=readFileSync('scripts/integration-queue-recovery.mjs','utf8'),returns=readFileSync('scripts/integration-rescue-return.mjs','utf8'),train=readFileSync('scripts/integration-virtual-train.mjs','utf8');
  assert.match(rescue,/Validate Virtual Integration Train/); assert.match(rescue,/validate\.mjs fast/); assert.match(rescue,/browser\/pr-smoke\.mjs/); assert.match(rescue,/contents: write/); assert.match(queue,/write\s*=\s*false/); assert.match(returns,/write:\s*true/); assert.match(train,/automation\/integration-train-/); assert.match(train,/DELETE/); assert.match(train,/status:\s*'validated'/);
});

test('workflow contracts coalesce CI and pause Code Health PR creation under pressure', () => {
  const ci=readFileSync('.github/workflows/ci.yml','utf8'),health=readFileSync('.github/workflows/code-health.yml','utf8');
  assert.match(ci,/group: ci-\$\{\{ github\.event\.pull_request\.number \}\}-/); assert.match(ci,/cancel-in-progress: true/); assert.match(health,/Measure Integration backlog pressure/); assert.match(health,/steps\.pressure\.outputs\.pause != 'true'/); assert.match(health,/41898282\+github-actions\[bot\]@users\.noreply\.github\.com/);
});

test('AI repair and PULSE expose Draft-to-DEV, Virtual Train and Quarantine without weakening gates', () => {
  const returns=readFileSync('scripts/integration-rescue-return.mjs','utf8'),flow=readFileSync('ops-board/public/flow-board.js','utf8'),index=readFileSync('ops-board/public/index.html','utf8'),quarantine=readFileSync('scripts/integration-quarantine-signal.mjs','utf8');
  assert.match(returns,/AI_REPAIR_REQUIRED/); assert.match(quarantine,/AI_DEEP_REPAIR_REQUIRED/); assert.match(flow,/Draft→Ready/); assert.match(flow,/Draft→DEV/); assert.match(flow,/Virtual Train/); assert.match(flow,/Quarantine/); assert.doesNotMatch(flow,/innerHTML/); assert.match(index,/id="integration-flow"/);
});
