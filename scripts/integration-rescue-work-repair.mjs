// Existing ChatGPT Work performs semantic review. Actions' safe base updater stays unchanged.
// Every operation is pure; callers persist through RescueStore CAS before external writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { REPOSITORY, manualReason, conflictScope, compareScopes, RETURNED, event, transition } from './integration-rescue-policy.mjs';
import { contractFingerprint, browserRepairFor } from './integration-rescue-store.mjs';

const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const LEASE_MS = 45 * 60000;
const semantic = r => /^FAILED_MANUAL:SEMANTIC_CONFLICT(?::|$)/.test(r.failureReason || '');
const active = r => r.workRepair?.status === 'working';
const key = e => createHash('sha256').update(JSON.stringify([e.pr.head.sha,e.develop,contractFingerprint(e.pr)])).digest('hex');

function safety(record, evidence) {
  const { pr, reviews, unresolved, complete, issues, files, filesComplete, develop, dependencies } = evidence;
  assert.ok(Array.isArray(reviews) && typeof unresolved === 'boolean' && complete === true, 'INCOMPLETE_REVIEWS');
  assert.equal(manualReason(pr, { reviews, unresolved, complete }), null, 'PR_HOLD_OR_REVIEW');
  assert.equal(pr.number, record.pr, 'WRONG_PR');
  assert.equal(pr.head.ref, record.branch, 'BRANCH_CHANGED');
  assert.ok(sha(pr.head.sha) && sha(develop), 'MISSING_IMMUTABLE_REFS');
  assert.ok(Array.isArray(issues), 'INCOMPLETE_BROWSER_OWNERSHIP');
  assert.equal(browserRepairFor(pr, issues), null, 'BROWSER_REPAIR_OWNS_PR');
  assert.ok(filesComplete === true && Array.isArray(files) && files.length > 0 && files.length === pr.changed_files, 'INCOMPLETE_FILES');
  const scope = conflictScope(files.flatMap(f => [f.filename,f.previous_filename].filter(Boolean)), pr.body);
  assert.equal(scope.control || scope.contract, false, 'CONTROL_OR_CONTRACT_REQUIRES_EXPLICIT_WORK');
  // Parse actual current dependencies, not a stale state record.
  const numbers = [...String(pr.body || '').matchAll(/^Depends-On:\s*(.*)$/gim)].flatMap(m => [...m[1].matchAll(/#(\d+)/g)].map(m => Number(m[1])));
  for (const number of numbers) {
    const dep = dependencies?.find(d => d.number === number);
    assert.ok(dep?.merged && dep.base?.ref === 'develop' && dep.base?.repo?.full_name === REPOSITORY, 'DEPENDENCY_NOT_MERGED');
  }
  return scope;
}
export function verifyWorkRepair(record, evidence) {
  assert.equal(record?.state, 'FAILED_MANUAL', 'NOT_MANUAL');
  assert.ok(semantic(record), 'NOT_SEMANTIC_CONFLICT');
  assert.ok(!record.lease && !record.pushLease, 'OTHER_WORKER_OWNS_PR');
  assert.equal(record.headSha, evidence.pr.head.sha, 'HEAD_CHANGED');
  assert.ok(record.workRepair?.status !== 'human-required', 'HUMAN_DECISION_REQUIRED');
  assert.ok(record.attempt < record.maxAttempts, 'ATTEMPTS_EXHAUSTED');
  return safety(record, evidence);
}
export function claimWorkRepair(state, prNumber, workerId, evidence, now = Date.now()) {
  assert.ok(typeof workerId === 'string' && /^work\/.+/.test(workerId) && workerId.length < 200, 'REAL_WORK_ID_REQUIRED');
  const r = state.records[prNumber], scope = verifyWorkRepair(r, evidence);
  assert.ok(!active(r) || now >= Date.parse(r.workRepair.expiresAt), 'WORK_REPAIR_ALREADY_CLAIMED');
  const peers = Object.values(state.records).filter(p => p.pr !== prNumber && (p.lease || RETURNED.has(p.state) || active(p)));
  assert.ok(!peers.some(p => compareScopes(scope,p.workRepair?.scope || p.scope).risk === 'RED'), 'RELATED_WORK_OWNS_SCOPE');
  assert.ok(Object.values(state.records).filter(p => p.lease || active(p) && p.pr !== prNumber).length < state.config.maxConcurrency, 'WORKER_POOL_FULL');
  r.attempt++;
  r.workRepair = { workerId, status:'working', attempt:r.attempt, sourceHead:evidence.pr.head.sha, develop:evidence.develop,
    contract:contractFingerprint(evidence.pr), evidenceKey:key(evidence), scope, startedAt:new Date(now).toISOString(),
    heartbeatAt:new Date(now).toISOString(), expiresAt:new Date(now + LEASE_MS).toISOString() };
  r.currentStep='RESOLVING';r.currentAction='既存ChatGPT Workが両側の仕様を確認し競合を修復';r.updatedAt=new Date(now).toISOString();
  event(state,r,'WORK_REPAIR_CLAIMED',`${workerId}: semantic review attempt ${r.attempt}/${r.maxAttempts}`,now);
  state.activity.at(-1).workerId=workerId;
  return r.workRepair;
}
function owned(state, prNumber, workerId, now) {
  const r=state.records[prNumber],w=r?.workRepair;
  assert.ok(r?.state==='FAILED_MANUAL' && active(r) && w.workerId===workerId && now<Date.parse(w.expiresAt), 'WORK_REPAIR_FENCED');
  return r;
}
export function heartbeatWorkRepair(state, prNumber, workerId, now = Date.now()) {
  const r=owned(state,prNumber,workerId,now);
  r.workRepair.heartbeatAt=new Date(now).toISOString();r.workRepair.expiresAt=new Date(now+LEASE_MS).toISOString();
  r.updatedAt=new Date(now).toISOString();
}
export function expireWorkRepair(state, prNumber, now = Date.now()) {
  const r=state.records[prNumber],w=r?.workRepair;
  if(!active(r) || now<Date.parse(w.expiresAt))return false;
  w.status='expired';w.reason='Work reservation expired; re-read actual PR before retry';
  r.currentStep='FAILED_MANUAL';r.currentAction=w.reason;r.updatedAt=new Date(now).toISOString();
  event(state,r,'WORK_REPAIR_EXPIRED',w.reason,now);
  return true;
}
export function prepareWorkRepairPush(state, prNumber, workerId, evidence, result, now = Date.now()) {
  const r=owned(state,prNumber,workerId,now),w=r.workRepair;
  safety(r,evidence);
  assert.equal(key(evidence),w.evidenceKey,'REPAIR_INPUT_CHANGED');
  assert.ok(result?.decision?.preservesBoth === true && result.decision.sources?.length > 0 && result.decision.summary?.trim(), 'SEMANTIC_REVIEW_REQUIRED');
  assert.ok(result.decision.sources.every(s=>s.path && [w.sourceHead,w.develop].includes(s.commit)) && [w.sourceHead,w.develop].every(commit=>result.decision.sources.some(s=>s.commit===commit)), 'PINNED_SPEC_SOURCES_REQUIRED');
  assert.ok(sha(result.head) && sha(result.tree), 'MISSING_RESULT_REFS');
  assert.equal(result.validation?.status,'passed','FAST_NOT_PASSED');
  assert.equal(result.validation.tree,result.tree,'UNTESTED_TREE');
  assert.equal(result.commit?.sha,result.head,'COMMIT_MISMATCH');
  assert.equal(result.commit.tree.sha,result.tree,'COMMIT_TREE_MISMATCH');
  assert.deepEqual(result.commit.parents.map(p=>p.sha),[w.sourceHead,w.develop],'REPAIR_PARENTS_CHANGED');
  assert.ok(result.changedPathsComplete === true && Array.isArray(result.changedPaths) && result.changedPaths.length>0,'INCOMPLETE_RESULT_SCOPE');
  const allowed=new Set(w.scope.files);
  assert.ok(result.changedPaths.every(p=>allowed.has(p) || w.scope.scopes.some(scope=>p.startsWith(scope+'/tests/') && /\.test\.[cm]?js$/.test(p))), 'REPAIR_SCOPE_EXPANDED');
  w.result=result;w.pushPreparedAt=new Date(now).toISOString();
  return { branch:r.branch,sha:result.head,force:false };
}
export function finishWorkRepair(state, prNumber, workerId, evidence, now = Date.now()) {
  return recordReturn(state,owned(state,prNumber,workerId,now),evidence,now);
}
// After an interrupted push, recover the observed result without pushing again.
export function recoverWorkRepair(state, prNumber, workerId, evidence, now = Date.now()) {
  const r=state.records[prNumber],w=r?.workRepair;
  assert.ok(r?.state==='FAILED_MANUAL' && ['working','expired'].includes(w?.status) && !r.lease && !r.pushLease, 'NOT_RECOVERABLE');
  assert.ok(w.workerId===workerId || now>=Date.parse(w.expiresAt),'WORK_REPAIR_ALREADY_CLAIMED');
  return recordReturn(state,r,evidence,now);
}
function recordReturn(state,r,evidence,now) {
  const w=r.workRepair,result=w.result;
  assert.ok(result,'REPAIR_NOT_PREPARED');
  safety(r,evidence);
  assert.equal(evidence.pr.head.sha,result.head,'PUSH_NOT_OBSERVED');
  assert.equal(evidence.develop,w.develop,'DEVELOP_CHANGED');
  assert.equal(contractFingerprint(evidence.pr),w.contract,'PR_CONTRACT_CHANGED');
  w.status='returned';w.finishedAt=new Date(now).toISOString();
  r.headSha=r.pushedSha=result.head;r.developSha=w.develop;r.validation={...result.validation,head:result.head};
  r.pushedAt=r.returnedAt=new Date(now).toISOString();r.pendingIntegration=true;
  transition(state,r,'RETURNED_TO_INTEGRATION','Workの仕様確認・fast検証・元PRへのpushを確認。通常Integrationへ返却',now);
  state.activity.at(-1).workerId=w.workerId;
}
export function stopWorkRepair(state, prNumber, workerId, reason, {humanRequired=true, now=Date.now()}={}) {
  const r=owned(state,prNumber,workerId,now),w=r.workRepair;
  assert.ok(typeof reason==='string' && reason.trim(),'STOP_REASON_REQUIRED');
  w.status=humanRequired?'human-required':'failed';w.reason=reason.slice(0,1000);w.finishedAt=new Date(now).toISOString();
  r.currentStep='FAILED_MANUAL';r.currentAction=reason.slice(0,240);r.updatedAt=new Date(now).toISOString();
  event(state,r,'WORK_REPAIR_STOPPED',`${w.status}: ${reason}`,now);
}
