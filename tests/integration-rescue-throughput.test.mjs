import test from 'node:test';
import assert from 'node:assert/strict';
import { rescueConfig, newState, failure } from '../scripts/integration-rescue-policy.mjs';
import { isIntegrationControlPlane, prioritizeReturnedReady, readyPriorityScore } from '../scripts/integration-rescue-priority.mjs';
import { reusableRescueFastEvidence } from '../scripts/integration-rescue-fast-evidence.mjs';

const sha = char => char.repeat(40);

test('throughput v2 raises production worker capacity through an explicit bounded override', () => {
  const base = rescueConfig({});
  const v2 = rescueConfig({ MAX_RESCUE_CONCURRENCY: '6' });
  assert.equal(base.maxConcurrency, 4);
  assert.equal(v2.maxConcurrency, 6);
  assert.equal(v2.maxEvaluations, 24);
  assert.equal(v2.scanMinMs, 60_000);
  assert.equal(v2.retryMs, 120_000);
  assert.equal(v2.queueStallMs, 300_000);
  assert.equal(v2.maxAttempts, 3);
  assert.ok(v2.apiReserve >= 100);
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

test('real repair failures still consume the bounded attempt and backoff', () => {
  const state = newState();
  const now = Date.parse('2026-09-14T00:00:00Z');
  const record = {
    pr: 2,
    state: 'CLAIMED',
    attempt: 2,
    maxAttempts: 3,
    lease: 'rescue-2',
    claimedBy: 'run/pr-2/a2',
    rescueId: 'rescue-2',
    failures: [],
  };
  state.records[2] = record;
  failure(state, record, 'VALIDATION_FAILED:npm:1', now, false);
  assert.equal(record.attempt, 2);
  assert.equal(record.state, 'FAILED_RETRYABLE');
  assert.equal(Date.parse(record.nextAttemptAt), now + state.config.retryMs * 2);
});

test('returned Rescue heads are evaluated before ordinary Ready PRs', () => {
  const ordinary = { number: 1, created_at: '2026-09-13T00:00:00Z', head: { sha: sha('1'), ref: 'feat/ordinary' } };
  const rescued = { number: 2, created_at: '2026-09-14T00:00:00Z', head: { sha: sha('2'), ref: 'feat/rescue-returned' } };
  const stale = { number: 3, created_at: '2026-09-12T00:00:00Z', head: { sha: sha('3'), ref: 'feat/ordinary-stale' } };
  const returned = new Map([[2, sha('2')], [3, sha('9')]]);
  assert.deepEqual(prioritizeReturnedReady([ordinary, stale, rescued], returned, Date.parse('2026-09-14T00:00:00Z')).map(item => item.number), [2, 3, 1]);
});

test('Integration control-plane Ready PRs get a bounded priority boost without starving old work', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const control = { number: 167, title: 'Rescueの競合停止を既存Workへ自動で引き継ぐ', created_at: '2026-09-14T11:00:00Z', head: { sha: sha('a'), ref: 'feat/rescue-work-conflict-repair' }, labels: [] };
  const recentOrdinary = { number: 168, title: 'gameplay polish', created_at: '2026-09-12T12:00:00Z', head: { sha: sha('b'), ref: 'feat/gameplay' }, labels: [] };
  const oldOrdinary = { number: 31, title: 'older work', created_at: '2026-09-10T12:00:00Z', head: { sha: sha('c'), ref: 'feat/older-work' }, labels: [] };
  assert.equal(isIntegrationControlPlane(control), true);
  assert.ok(readyPriorityScore(control, new Map(), now).score > readyPriorityScore(recentOrdinary, new Map(), now).score,
    'control-plane work should overtake a merely recent ordinary PR');
  assert.ok(readyPriorityScore(oldOrdinary, new Map(), now).score > readyPriorityScore(control, new Map(), now).score,
    'aging must eventually overtake the control-plane boost');
  assert.deepEqual(prioritizeReturnedReady([recentOrdinary, control, oldOrdinary], new Map(), now).map(item => item.number), [31, 167, 168]);
});

test('integration:repair gets a stronger bounded boost than ordinary control-plane work', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const repair = { number: 1, created_at: '2026-09-14T12:00:00Z', head: { sha: sha('d'), ref: 'fix/app' }, labels: [{ name: 'integration:repair' }] };
  const control = { number: 2, created_at: '2026-09-14T12:00:00Z', head: { sha: sha('e'), ref: 'fix/integration-rescue-throughput' }, labels: [] };
  assert.ok(readyPriorityScore(repair, new Map(), now).score > readyPriorityScore(control, new Map(), now).score);
});

test('fast evidence reuse requires exact state, commit tree, parents, artifact and successful Actions worker', async () => {
  const head = sha('c');
  const tree = sha('d');
  const original = sha('a');
  const develop = sha('b');
  const rescueId = 'wave-77-pr-9-a1';
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
        stagedParents: [original, develop],
        validation: { status: 'passed', head, testedTree: tree, at: '2026-09-14T00:00:00Z' },
        runId: '77',
        rescueId,
        claimedBy: '77/pr-9/a1',
      },
    },
  };
  const encoded = Buffer.from(JSON.stringify(state)).toString('base64');
  const c = {
    root: '/repos/charukun/soul-lineage',
    async api(method, path) {
      if (path.includes('/contents/rescue-state.json')) return { encoding: 'base64', content: encoded };
      if (path.endsWith(`/git/commits/${head}`)) return { sha: head, tree: { sha: tree }, parents: [{ sha: original }, { sha: develop }] };
      if (path.endsWith('/actions/runs/77')) return { id: 77, repository: { full_name: 'charukun/soul-lineage' }, head_branch: 'develop', path: '.github/workflows/deploy.yml', status: 'completed', conclusion: 'success' };
      throw new Error(`unexpected ${method} ${path}`);
    },
    async pages(path) {
      if (path.includes('/actions/runs/77/jobs')) return [{ name: 'Rescue PR 9', status: 'completed', conclusion: 'success', steps: [{ name: 'Verify the safe base update and stage its exact commit for Work push', conclusion: 'success' }] }];
      if (path.includes('/actions/runs/77/artifacts')) return [{ name: `integration-rescue-pr-9-${rescueId}`, expired: false }];
      throw new Error(`unexpected pages ${path}`);
    },
  };
  const evidence = await reusableRescueFastEvidence(c, 9, head);
  assert.equal(evidence.head, head);
  assert.equal(evidence.tree, tree);
  assert.equal(evidence.runId, '77');
  assert.equal(await reusableRescueFastEvidence(c, 9, sha('e')), null, 'different exact head must fall back to normal CI');
});
