// Pure operations for the existing ChatGPT Work GitHub connector. No API model,
// embedded credential, alternate validation status or direct develop update.
import assert from 'node:assert/strict';
import { REPOSITORY, manualReason, evaluateSnapshot, event, transition, failure } from './integration-rescue-policy.mjs';
import { contractFingerprint, browserRepairFor } from './integration-rescue-store.mjs';

export function verifyWorkPush(record, evidence) {
  const { pr, reviews, unresolved, complete, issues, develop, baseChanges, consumers, commit, run, jobs, dependencies } = evidence;
  assert.equal(record.state, 'AWAITING_PUSH', 'NOT_AWAITING_PUSH');
  assert.equal(record.lease, null, 'ACTIONS_WORKER_STILL_OWNS_LEASE');
  assert.equal(manualReason(pr, { reviews, unresolved, complete }), null, 'PR_REVIEW_OR_HOLD');
  assert.ok(Array.isArray(reviews) && typeof unresolved === 'boolean' && complete === true, 'INCOMPLETE_REVIEW_EVIDENCE');
  assert.equal(pr.head.ref, record.branch, 'HEAD_BRANCH_CHANGED');
  assert.equal(contractFingerprint(pr), record.contractFingerprint, 'PR_CONTRACT_CHANGED');
  assert.ok([record.headSha, record.stagedSha].includes(pr.head.sha), 'HEAD_CHANGED');
  assert.ok(Array.isArray(issues), 'INCOMPLETE_BROWSER_REPAIR_EVIDENCE');
  assert.equal(browserRepairFor(pr, issues), null, 'BROWSER_REPAIR_OWNS_PR');
  for (const n of record.dependencies || []) {
    const dep = dependencies?.find(d => d.number === n);
    assert.ok(dep?.merged && dep.base.ref === 'develop' && dep.base.repo.full_name === REPOSITORY, 'DEPENDENCY_NOT_MERGED');
  }
  const snapshot = evaluateSnapshot(record, { head: record.headSha, develop, baseChanges, consumers });
  assert.equal(snapshot.valid, true, snapshot.reason);
  assert.equal(record.validation?.status, 'passed', 'FAST_NOT_PASSED');
  assert.equal(record.validation.head, record.stagedSha, 'UNTESTED_COMMIT');
  assert.equal(record.validation.testedTree, record.stagedTree, 'UNTESTED_TREE');
  assert.equal(commit.sha, record.stagedSha, 'STAGED_COMMIT_MISMATCH');
  assert.equal(commit.tree.sha, record.stagedTree, 'STAGED_TREE_MISMATCH');
  assert.deepEqual(commit.parents.map(p => p.sha), [record.headSha, record.developSha], 'STAGED_PARENTS_MISMATCH');
  assert.equal(String(run.id), String(record.runId), 'WRONG_ACTIONS_RUN');
  assert.equal(run.head_branch, 'develop', 'UNTRUSTED_ACTIONS_BRANCH');
  assert.equal(run.repository.full_name, REPOSITORY, 'UNTRUSTED_ACTIONS_REPOSITORY');
  assert.equal(run.path, '.github/workflows/deploy.yml', 'UNTRUSTED_ACTIONS_WORKFLOW');
  assert.equal(run.status, 'completed', 'ACTIONS_RUN_NOT_FINISHED');
  const job = jobs.find(j => j.name === `Rescue PR ${record.pr}` || j.name.endsWith(` / Rescue PR ${record.pr}`));
  assert.equal(job?.status, 'completed', 'WORKER_NOT_FINISHED');
  assert.equal(job?.conclusion, 'success', 'WORKER_NOT_SUCCESSFUL');
  assert.ok(job.steps.some(s => s.name === 'Verify the safe base update and stage its exact commit for Work push' && s.conclusion === 'success'), 'STAGING_NOT_SUCCESSFUL');
  return { branch: record.branch, sha: record.stagedSha, force: false, alreadyPushed: pr.head.sha === record.stagedSha };
}

export function claimWorkPush(state, prNumber, rescueId, workerId, evidence, now = Date.now()) {
  assert.ok(typeof workerId === 'string' && workerId.startsWith('work/') && workerId.length < 200, 'REAL_WORK_ID_REQUIRED');
  const record = state.records[prNumber];
  assert.equal(record?.rescueId, rescueId, 'RESCUE_REPLACED');
  const operation = verifyWorkPush(record, evidence);
  // A retry by another Work may recover an expired relay reservation; the old
  // owner must re-read this fence before the ordinary fast-forward ref update.
  assert.ok(!record.pushLease || record.pushLease.workerId === workerId || now - Date.parse(record.pushLease.at) > 600000, 'PUSH_RELAY_ALREADY_CLAIMED');
  record.pushLease = { workerId, at: new Date(now).toISOString() };
  record.pushWorkerId = workerId;
  event(state, record, 'WORK_PUSH_CLAIMED', `Existing ChatGPT Work push relay: ${workerId}`, now);
  return operation;
}

export function finishWorkPush(state, prNumber, rescueId, workerId, evidence, now = Date.now()) {
  const record = state.records[prNumber];
  assert.equal(record?.rescueId, rescueId, 'RESCUE_REPLACED');
  assert.equal(record.pushLease?.workerId, workerId, 'PUSH_RELAY_FENCED');
  assert.equal(evidence.pr.head.sha, record.stagedSha, 'PUSH_NOT_OBSERVED');
  // Preserve the true push even if the final safety recheck requests a retry.
  let invalid; try { verifyWorkPush(record, evidence); } catch (error) { invalid = error; }
  record.pushedSha = record.stagedSha; record.headSha = record.stagedSha;
  record.pushedAt = new Date(now).toISOString(); record.pushLease = null;
  transition(state, record, 'PUSHED', 'Workの既存GitHub接続による元PRへの通常pushを実測', now);
  if (invalid) { failure(state, record, `WORK_PUSH_RECHECK:${invalid.message}`, now, /HOLD|REVIEW|CONTRACT|BRANCH/.test(invalid.message)); return; }
  record.pendingIntegration = true; record.returnedAt = new Date(now).toISOString();
  transition(state, record, 'RETURNED_TO_INTEGRATION', '元PRの新headを通常CI・Integrationへ返却。API課金なし', now);
}
