import assert from 'node:assert/strict';
import { REPOSITORY, manualReason, event, transition } from './integration-rescue-policy.mjs';
import { browserRepairFor, contractFingerprint } from './integration-rescue-store.mjs';

function verifyDependencies(record, dependencies = []) {
  for (const number of record.dependencies || []) {
    const dep = dependencies.find(item => item.number === number);
    assert.ok(dep?.merged && dep.base?.ref === 'develop' && dep.base?.repo?.full_name === REPOSITORY, 'DEPENDENCY_NOT_MERGED');
  }
}

export function verifySemanticWork(record, evidence) {
  const { pr, reviews, unresolved, complete, issues, dependencies } = evidence;
  assert.ok(['AWAITING_SEMANTIC_WORK', 'SEMANTIC_WORKING'].includes(record.state), 'SEMANTIC_WORK_NOT_REQUESTED');
  assert.equal(manualReason(pr, { reviews, unresolved, complete }), null, 'PR_REVIEW_OR_HOLD');
  assert.ok(Array.isArray(reviews) && typeof unresolved === 'boolean' && complete === true, 'INCOMPLETE_REVIEW_EVIDENCE');
  assert.ok(Array.isArray(issues), 'INCOMPLETE_BROWSER_REPAIR_EVIDENCE');
  assert.equal(browserRepairFor(pr, issues), null, 'BROWSER_REPAIR_OWNS_PR');
  assert.equal(pr.base?.ref, 'develop', 'WRONG_BASE');
  assert.equal(pr.base?.repo?.full_name, REPOSITORY, 'WRONG_BASE_REPOSITORY');
  assert.equal(pr.head?.repo?.full_name, REPOSITORY, 'WRONG_HEAD_REPOSITORY');
  assert.equal(pr.head?.ref, record.branch, 'HEAD_BRANCH_CHANGED');
  assert.equal(pr.head?.sha, record.headSha, 'HEAD_CHANGED');
  assert.equal(contractFingerprint(pr), record.contractFingerprint, 'PR_CONTRACT_CHANGED');
  verifyDependencies(record, dependencies);
  return { branch: record.branch, head: record.headSha, reason: record.semanticReason || record.failureReason };
}

export function claimSemanticWork(state, prNumber, rescueId, workerId, evidence, now = Date.now()) {
  assert.ok(typeof workerId === 'string' && workerId.startsWith('work/') && workerId.length < 200, 'REAL_WORK_ID_REQUIRED');
  const record = state.records[prNumber];
  assert.equal(record?.rescueId, rescueId, 'RESCUE_REPLACED');
  assert.equal(record.state, 'AWAITING_SEMANTIC_WORK', 'SEMANTIC_WORK_NOT_WAITING');
  verifySemanticWork(record, evidence);
  assert.ok(!record.semanticLease || record.semanticLease.workerId === workerId || now - Date.parse(record.semanticLease.at) > 3600000, 'SEMANTIC_WORK_ALREADY_CLAIMED');
  record.semanticLease = { workerId, at: new Date(now).toISOString() };
  record.semanticWorkerId = workerId;
  record.semanticAttempt = (record.semanticAttempt || 0) + 1;
  event(state, record, 'SEMANTIC_WORK_CLAIMED', `Existing ChatGPT Work semantic rescue: ${workerId}`, now);
  transition(state, record, 'SEMANTIC_WORKING', '最新developとPR意図を読んで意味的競合を解消中', now);
  return { branch: record.branch, head: record.headSha, reason: record.semanticReason || record.failureReason };
}

export function finishSemanticWork(state, prNumber, rescueId, workerId, evidence, now = Date.now()) {
  const record = state.records[prNumber];
  assert.equal(record?.rescueId, rescueId, 'RESCUE_REPLACED');
  assert.equal(record.state, 'SEMANTIC_WORKING', 'SEMANTIC_WORK_NOT_ACTIVE');
  assert.equal(record.semanticLease?.workerId, workerId, 'SEMANTIC_WORK_FENCED');
  const { pr, reviews, unresolved, complete, issues, dependencies, previousHead, repairSha } = evidence;
  assert.equal(previousHead, record.headSha, 'SEMANTIC_BASE_HEAD_CHANGED');
  assert.match(repairSha || '', /^[0-9a-f]{40}$/i, 'SEMANTIC_REPAIR_SHA_REQUIRED');
  assert.notEqual(repairSha, record.headSha, 'SEMANTIC_REPAIR_DID_NOT_CHANGE_HEAD');
  assert.equal(pr.head?.sha, repairSha, 'SEMANTIC_PUSH_NOT_OBSERVED');
  assert.equal(pr.head?.ref, record.branch, 'HEAD_BRANCH_CHANGED');
  assert.equal(manualReason(pr, { reviews, unresolved, complete }), null, 'PR_REVIEW_OR_HOLD');
  assert.ok(Array.isArray(issues) && browserRepairFor(pr, issues) === null, 'BROWSER_REPAIR_OWNS_PR');
  verifyDependencies(record, dependencies);
  record.previousPushedSha = record.pushedSha || record.previousPushedSha || null;
  record.headSha = repairSha;
  record.pushedSha = repairSha;
  record.pushedAt = new Date(now).toISOString();
  record.returnedAt = new Date(now).toISOString();
  record.pendingIntegration = true;
  record.semanticLease = null;
  record.semanticResolvedAt = new Date(now).toISOString();
  record.semanticResolution = String(evidence.summary || 'Semantic Rescue reconciled current develop and PR intent').slice(0, 240);
  record.validation = null;
  delete record.stagedSha;
  delete record.stagedTree;
  delete record.stagedParents;
  delete record.stagedAt;
  event(state, record, 'SEMANTIC_WORK_PUSHED', `Semantic Rescue pushed ${repairSha.slice(0, 12)} to the original PR branch`, now);
  transition(state, record, 'RETURNED_TO_INTEGRATION', 'Semantic Rescue完了。通常CI・review・Integrationのexact-head gateへ返却', now);
  return record;
}

export function failSemanticWork(state, prNumber, rescueId, workerId, reason, now = Date.now()) {
  const record = state.records[prNumber];
  assert.equal(record?.rescueId, rescueId, 'RESCUE_REPLACED');
  assert.equal(record.semanticLease?.workerId, workerId, 'SEMANTIC_WORK_FENCED');
  const text = `SEMANTIC_WORK_FAILED:${String(reason || 'human specification decision required').slice(0, 320)}`;
  record.semanticLease = null;
  record.failureReason = text;
  record.failures = [...(record.failures || []), { reason: text, at: new Date(now).toISOString(), workerId, attempt: record.attempt, rescueId }].slice(-10);
  transition(state, record, 'FAILED_MANUAL', text, now);
  state.outbox.push({ id: `${rescueId}:semantic-manual:${record.semanticAttempt || 1}`, type: 'manual', pr: record.pr, reason: text, attempt: record.attempt, maxAttempts: record.maxAttempts });
  return record;
}
