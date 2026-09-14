import test from 'node:test';
import assert from 'node:assert/strict';
import { rescueConfig, newState, failure } from '../scripts/integration-rescue-policy.mjs';
import { contractFingerprint } from '../scripts/integration-rescue-store.mjs';
import { claimSemanticWork, finishSemanticWork } from '../scripts/integration-rescue-semantic-work.mjs';
import { prioritizeReturnedReady } from '../scripts/integration-rescue-priority.mjs';
import { reusableRescueFastEvidence } from '../scripts/integration-rescue-fast-evidence.mjs';

const sha = char => char.repeat(40);
const prFixture = ({ number = 12, head = sha('a'), branch = 'feat/example' } = {}) => ({
  number,
  state: 'open',
  draft: false,
  author_association: 'OWNER',
  title: 'Example rescue PR',
  body: 'Example change\nSafe fixture\n\nDepends-On: none',
  labels: [],
  base: { ref: 'develop', repo: { full_name: 'charukun/soul-lineage' } },
  head: { ref: branch, sha: head, repo: { full_name: 'charukun/soul-lineage' } },
});

test('throughput defaults increase bounded scan capacity without removing safety limits', () => {
  const config = rescueConfig({});
  assert.equal(config.maxConcurrency, 6);
  assert.equal(config.maxEvaluations, 24);
  assert.equal(config.scanMinMs, 60_000);
  assert.equal(config.retryMs, 120_000);
  assert.equal(config.queueStallMs, 300_000);
  assert.equal(config.maxAttempts, 3);
  assert.ok(config.apiReserve >= 100);
});

test('mutable observation races do not consume a repair attempt', () => {
  const state = newState();
  const now = Date.parse('2026-09-14T00:00:00Z');
  const record = {
    pr: 1,
    state: 'CLAIMED',
    attempt: 2,
    maxAttempts: 3,
    lease: 'rescue-1',
    claimedBy: 'run/pr-1/a2',
    rescueId: 'rescue-1',
    failures: [],
  };
  state.records[1] = record;
  failure(state, record, 'PR_CONTRACT_CHANGED', now, false);
  assert.equal(record.attempt, 1);
  assert.equal(record.state, 'FAILED_RETRYABLE');
  assert.equal(record.lease, null);
  assert.equal(Date.parse(record.nextAttemptAt), now + state.config.scanMinMs);
  assert.equal(record.failures.at(-1).attempt, 2, 'diagnostics retain the attempt that observed the race');
});

test('semantic conflicts hand off to Work instead of becoming terminal manual immediately', () => {
  const state = newState();
  const record = {
    pr: 2,
    state: 'ANALYZING',
    attempt: 1,
    maxAttempts: 3,
    lease: 'rescue-2',
    claimedBy: 'run/pr-2/a1',
    rescueId: 'rescue-2',
    failures: [],
  };
  state.records[2] = record;
  failure(state, record, 'FAILED_MANUAL:SEMANTIC_CONFLICT:apps/rinne/src/main.js', Date.now(), true);
  assert.equal(record.state, 'AWAITING_SEMANTIC_WORK');
  assert.equal(record.lease, null);
  assert.equal(record.nextAttemptAt, null);
  assert.match(record.semanticReason, /SEMANTIC_CONFLICT/);
  assert.equal(state.outbox.at(-1).type, 'semantic');
});

test('Semantic Work claim and finish require the original PR and a real pushed repair head', () => {
  const before = prFixture({ number: 12, head: sha('a'), branch: 'feat/semantic' });
  const state = newState();
  state.records[12] = {
    pr: 12,
    state: 'AWAITING_SEMANTIC_WORK',
    rescueId: 'wave-1-pr-12-a1',
    branch: before.head.ref,
    headSha: before.head.sha,
    contractFingerprint: contractFingerprint(before),
    dependencies: [],
    attempt: 1,
    maxAttempts: 3,
    semanticReason: 'FAILED_MANUAL:OVERLAPPING_CHANGES:apps/rinne/src/main.js',
    failures: [],
  };
  const safeEvidence = { pr: before, reviews: [], unresolved: false, complete: true, issues: [], dependencies: [] };
  const operation = claimSemanticWork(state, 12, state.records[12].rescueId, 'work/semantic-test', safeEvidence, 1000);
  assert.equal(operation.head, before.head.sha);
  assert.equal(state.records[12].state, 'SEMANTIC_WORKING');

  const repairSha = sha('b');
  const after = { ...before, head: { ...before.head, sha: repairSha } };
  finishSemanticWork(state, 12, state.records[12].rescueId, 'work/semantic-test', {
    ...safeEvidence,
    pr: after,
    previousHead: before.head.sha,
    repairSha,
    summary: 'preserved current develop and PR intent',
  }, 2000);
  assert.equal(state.records[12].state, 'RETURNED_TO_INTEGRATION');
  assert.equal(state.records[12].pushedSha, repairSha);
  assert.equal(state.records[12].pendingIntegration, true);
  assert.equal(state.records[12].validation, null, 'semantic edits must run normal exact-head CI');
});

test('returned Rescue heads are evaluated before ordinary Ready PRs', () => {
  const ordinary = { number: 1, head: { sha: sha('1') } };
  const rescued = { number: 2, head: { sha: sha('2') } };
  const stale = { number: 3, head: { sha: sha('3') } };
  const returned = new Map([[2, sha('2')], [3, sha('9')]]);
  assert.deepEqual(prioritizeReturnedReady([ordinary, stale, rescued], returned).map(item => item.number), [2, 1, 3]);
});

test('fast evidence reuse requires exact state, commit tree and successful Actions worker', async () => {
  const head = sha('c');
  const tree = sha('d');
  const state = {
    schema: 1,
    repository: 'charukun/soul-lineage',
    records: {
      9: {
        pr: 9,
        mode: 'reconcile',
        pushedSha: head,
        stagedSha: head,
        stagedTree: tree,
        validation: { status: 'passed', head, testedTree: tree, at: '2026-09-14T00:00:00Z' },
        runId: '77',
        rescueId: 'wave-77-pr-9-a1',
        claimedBy: '77/pr-9/a1',
      },
    },
  };
  const encoded = Buffer.from(JSON.stringify(state)).toString('base64');
  const c = {
    root: '/repos/charukun/soul-lineage',
    async api(method, path) {
      if (path.includes('/contents/rescue-state.json')) return { encoding: 'base64', content: encoded };
      if (path.endsWith(`/git/commits/${head}`)) return { sha: head, tree: { sha: tree } };
      if (path.endsWith('/actions/runs/77')) return { id: 77, repository: { full_name: 'charukun/soul-lineage' }, head_branch: 'develop', path: '.github/workflows/deploy.yml', status: 'completed', conclusion: 'success' };
      throw new Error(`unexpected ${method} ${path}`);
    },
    async pages(path) {
      if (path.includes('/actions/runs/77/jobs')) return [{ name: 'Rescue PR 9', status: 'completed', conclusion: 'success', steps: [{ name: 'Verify the safe base update and stage its exact commit for Work push', conclusion: 'success' }] }];
      throw new Error(`unexpected pages ${path}`);
    },
  };
  const evidence = await reusableRescueFastEvidence(c, 9, head);
  assert.equal(evidence.head, head);
  assert.equal(evidence.tree, tree);
  assert.equal(evidence.runId, '77');
  assert.equal(await reusableRescueFastEvidence(c, 9, sha('e')), null, 'different exact head must fall back to normal CI');
});
