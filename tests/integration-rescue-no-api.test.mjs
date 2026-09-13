import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, safeUpdateReport, stageVerifiedCommit } from '../scripts/integration-rescue-worker.mjs';
import { claimWorkPush, finishWorkPush, verifyWorkPush } from '../scripts/integration-rescue-work-push.mjs';
import { REPOSITORY, newState, conflictScope } from '../scripts/integration-rescue-policy.mjs';
import { contractFingerprint } from '../scripts/integration-rescue-store.mjs';
import { rescueView } from '../ops-board/rescue.mjs';

test('a real disjoint Git merge preserves PR blobs and stages only its tested tree, without moving any ref', async () => {
  const work = mkdtempSync(join(tmpdir(), 'rescue-no-api-'));
  try {
    git(['init', '-b', 'develop'], work); git(['config', 'user.name', 'test'], work); git(['config', 'user.email', 'test@example.invalid'], work);
    mkdirSync(join(work, 'docs')); writeFileSync(join(work, 'docs/base.md'), 'base\n');
    git(['add', '.'], work); git(['commit', '-m', 'base'], work);
    git(['checkout', '-b', 'work/test'], work); writeFileSync(join(work, 'docs/purpose.md'), 'PR intent\n');
    git(['add', '.'], work); git(['commit', '-m', 'PR'], work); const headSha = git(['rev-parse', 'HEAD'], work);
    git(['checkout', 'develop'], work); writeFileSync(join(work, 'docs/base.md'), 'advanced base\n');
    git(['add', '.'], work); git(['commit', '-m', 'advance'], work); const developSha = git(['rev-parse', 'HEAD'], work);
    git(['checkout', 'work/test'], work); git(['merge', '--no-commit', '--no-ff', developSha], work);
    const record = { pr: 1, headSha, developSha, rescueId: 'real-git-test', scope: conflictScope(['docs/purpose.md']), baseChanges: ['docs/base.md'] };
    assert.equal(safeUpdateReport(record, work, []).decision, 'READY');
    assert.throws(() => safeUpdateReport(record, work, ['docs/purpose.md']), /SEMANTIC_CONFLICT/);
    assert.throws(() => safeUpdateReport({ ...record, baseChanges: ['docs/purpose.md'] }, work, []), /OVERLAPPING_CHANGES/);
    const related = { ...record, scope: conflictScope(['apps/village/src/a.js']), baseChanges: ['apps/village/src/b.js'] };
    assert.throws(() => safeUpdateReport(related, work, []), /RELATED_CODE_RECONCILIATION/);
    git(['commit', '-m', 'validated merge'], work); const tested = git(['rev-parse', 'HEAD'], work), expectedTree = git(['rev-parse', 'HEAD^{tree}'], work);
    const requests = [];
    const c = { root: `/repos/${REPOSITORY}`, async api(method, path, body) { requests.push({ method, path, body }); return path.endsWith('/trees') ? { sha: expectedTree } : { sha: 'c'.repeat(40) }; } };
    const staged = await stageVerifiedCommit(c, record, work, tested);
    assert.equal(staged.tree, expectedTree); assert.deepEqual(staged.parents, [headSha, developSha]);
    assert.deepEqual(requests.map(r => r.path.split('/').at(-1)), ['trees', 'commits']);
    assert.deepEqual(requests[0].body.tree.map(e => e.path), ['docs/base.md']);
    assert.ok(requests[0].body.tree.every(e => e.sha && !e.content));
    assert.equal(git(['rev-parse', 'develop'], work), developSha);
    await assert.rejects(stageVerifiedCommit({ ...c, api: async () => ({ sha: 'wrong' }) }, record, work, tested), /STAGED_TREE_MISMATCH/);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

function ready() {
  const head = 'a'.repeat(40), develop = 'b'.repeat(40), staged = 'c'.repeat(40), tree = 'd'.repeat(40);
  const pr = { number: 1, state: 'open', draft: false, title: 'Safe docs update', body: 'Depends-On: none', labels: [], author_association: 'OWNER',
    head: { sha: head, ref: 'work/test', repo: { full_name: REPOSITORY } }, base: { ref: 'develop', repo: { full_name: REPOSITORY } } };
  const state = newState(); state.coordinator.configured = true;
  const record = state.records[1] = { pr: 1, state: 'AWAITING_PUSH', lease: null, headSha: head, developSha: develop, branch: pr.head.ref,
    rescueId: 'wave-123-pr-1-a1', runId: '123', stagedSha: staged, stagedTree: tree, scope: conflictScope(['docs/test.md']), dependencies: [],
    contractFingerprint: contractFingerprint(pr), validation: { status: 'passed', head: staged, testedTree: tree } };
  const evidence = { pr, reviews: [], unresolved: false, complete: true, issues: [], dependencies: [], develop, baseChanges: [], consumers: {},
    commit: { sha: staged, tree: { sha: tree }, parents: [{ sha: head }, { sha: develop }] },
    run: { id: 123, status: 'completed', path: '.github/workflows/deploy.yml', head_branch: 'develop', repository: { full_name: REPOSITORY } },
    jobs: [{ name: 'Parallel Integration Rescue / Rescue PR 1', status: 'completed', conclusion: 'success', steps: [
      { name: 'Verify the safe base update and stage its exact commit for Work push', conclusion: 'success' }] }] };
  return { state, record, evidence };
}
test('Work connector push requires the exact staged tree, successful real worker and unchanged PR safety evidence', () => {
  const { record, evidence } = ready(); assert.deepEqual(verifyWorkPush(record, evidence), { branch: 'work/test', sha: record.stagedSha, force: false, alreadyPushed: false });
  for (const modify of [
    e => e.pr.draft = true, e => e.pr.head.sha = 'e'.repeat(40), e => e.pr.head.ref = 'main', e => e.pr.body = 'Integration-Hold: undecided',
    e => e.reviews = [{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'maintainer' } }], e => e.unresolved = true, e => e.complete = false,
    e => e.commit.tree.sha = 'wrong', e => e.commit.parents.reverse(), e => e.run.head_branch = 'work/evil', e => e.run.status = 'in_progress',
    e => e.jobs[0].conclusion = 'failure', e => e.jobs[0].steps = [], e => e.run.path = '.github/workflows/other.yml',
  ]) { const copy = structuredClone(evidence); modify(copy); assert.throws(() => verifyWorkPush(record, copy), modify.toString()); }
});
test('Work reservation is fenced, actual push is required, and completion returns to ordinary CI without manufacturing approval', () => {
  const { state, record, evidence } = ready(); const id = record.rescueId;
  claimWorkPush(state, 1, id, 'work/session-actual', evidence, 1000);
  assert.throws(() => claimWorkPush(state, 1, id, 'work/duplicate', evidence, 2000), /ALREADY_CLAIMED/);
  assert.throws(() => finishWorkPush(state, 1, id, 'work/session-actual', evidence, 3000), /PUSH_NOT_OBSERVED/);
  evidence.pr.head.sha = record.stagedSha;
  assert.throws(() => finishWorkPush(state, 1, id, 'work/old', evidence, 4000), /FENCED/);
  finishWorkPush(state, 1, id, 'work/session-actual', evidence, 5000);
  assert.equal(record.state, 'RETURNED_TO_INTEGRATION'); assert.equal(record.pendingIntegration, true); assert.equal(record.lease, null);
  assert.deepEqual(state.activity.map(e => e.type), ['WORK_PUSH_CLAIMED', 'PUSHED', 'RETURNED_TO_INTEGRATION']);
  assert.equal(evidence.reviews.length, 0);
});
test('PULSE distinguishes staged commit from push/Integration success and never counts a waiting relay as a live worker', () => {
  const { state } = ready(); const view = rescueView(state);
  assert.equal(view.status, 'WAITING'); assert.equal(view.counts.active, 0); assert.equal(view.counts.returned, 0); assert.equal(view.counts.awaitingPush, 1);
  assert.equal(view.recent[0].pushedSha, null); assert.equal(view.recent[0].stagedSha, 'c'.repeat(40));
});
test('Rescue has no paid API action or PAT prerequisite and preserves the original CI validation path', () => {
  const workflow = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|RESCUE_GITHUB_TOKEN|openai\/codex-action|RINNE_CODEX_MODEL/);
  assert.match(workflow, /RESCUE_VALIDATION_USER: rescue-agent/);
  assert.match(workflow, /sudo chown -R root:root control/);
  assert.doesNotMatch(readFileSync('scripts/integration-rescue-work-push.mjs', 'utf8'), /integration\/trusted-review|APPROVE|checksPassed: true/);
});
