import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conflictScope } from '../scripts/integration-rescue-policy.mjs';
import { buildReconciliationPlan, finalizeReconciliationPlan } from '../scripts/integration-reconciliation-plan.mjs';

const REPOSITORY = 'charukun/soul-lineage';
const head = number => number.toString(16).padStart(40, '0').slice(-40);
const pr = (number, {
  body = 'Depends-On: none',
  labels = [],
  branch = `feat/p${number}`,
  created = `2026-09-14T0${number % 9}:00:00Z`,
} = {}) => ({
  number,
  state: 'open',
  draft: false,
  title: `PR ${number}`,
  body,
  created_at: created,
  updated_at: created,
  author_association: 'OWNER',
  labels: labels.map(name => ({ name })),
  base: { ref: 'develop', repo: { full_name: REPOSITORY } },
  head: { ref: branch, sha: head(number), repo: { full_name: REPOSITORY } },
});

const scopes = entries => new Map(entries.map(([number, files, body = '']) => [number, conflictScope(files, body)]));

test('planner keeps independent progress when another PR is dependency-blocked', () => {
  const items = [
    pr(1),
    pr(2, { body: 'Depends-On: #99' }),
    pr(3),
  ];
  const plan = buildReconciliationPlan({
    ready: items,
    scopeByPr: scopes([
      [1, ['apps/rinne/src/a.js']],
      [2, ['apps/rinne/src/b.js']],
      [3, ['apps/village/src/a.js']],
    ]),
    dependencyStateByPr: new Map([[99, { merged: false }]]),
  });
  assert.deepEqual(plan.blocked.map(item => item.pr), [2]);
  assert.deepEqual(plan.writerOrder, [1, 3]);
  assert.equal(plan.wakeAgain, true);
  assert.equal(plan.actionableIdle, true);
});

test('planner groups only GREEN scopes and never batches same-package YELLOW or control-plane RED', () => {
  const items = [pr(1), pr(2), pr(3), pr(4), pr(5)];
  const plan = buildReconciliationPlan({
    ready: items,
    scopeByPr: scopes([
      [1, ['apps/rinne/src/a.js']],
      [2, ['apps/village/src/a.js']],
      [3, ['apps/demon/src/a.js']],
      [4, ['apps/rinne/src/b.js']],
      [5, ['scripts/integration.mjs']],
    ]),
    maxTrainSize: 5,
  });
  assert.equal(plan.trains.length, 1);
  assert.deepEqual(plan.trains[0].members.map(item => item.pr), [1, 2, 3]);
  assert.deepEqual(plan.singles.map(item => item.pr).sort((a,b)=>a-b), [4, 5]);
});

test('repair is an executor lane rather than a second Integration queue', () => {
  const items = [pr(1), pr(2), pr(3)];
  const records = new Map([
    [1, { pr:1, state:'FAILED_RETRYABLE', failureReason:'MERGE_CONFLICT' }],
    [2, { pr:2, state:'FAILED_MANUAL', failureReason:'FAILED_MANUAL:SEMANTIC_CONFLICT:x', workRepairAttempts:0 }],
    [3, { pr:3, state:'ANALYZING', lease:{ id:'lease' }, currentAction:'repairing exact head' }],
  ]);
  const plan = buildReconciliationPlan({
    ready: items,
    scopeByPr: scopes([
      [1, ['apps/rinne/src/a.js']],
      [2, ['apps/village/src/a.js']],
      [3, ['apps/demon/src/a.js']],
    ]),
    recordsByPr: records,
  });
  assert.deepEqual(plan.repair.map(item => item.pr), [1, 2]);
  assert.deepEqual(plan.active.map(item => item.pr), [3]);
  assert.deepEqual(plan.writerOrder, []);
  assert.equal(plan.actionableIdle, false);
});

test('integration:repair writer candidates are prioritized without bypassing writer safety', () => {
  const items = [pr(1), pr(2, { labels:['integration:repair'] }), pr(3)];
  const plan = buildReconciliationPlan({
    ready: items,
    scopeByPr: scopes([
      [1, ['apps/rinne/src/a.js']],
      [2, ['apps/village/src/a.js']],
      [3, ['apps/demon/src/a.js']],
    ]),
  });
  assert.equal(plan.writerOrder[0], 2);
  assert.equal(plan.writer.length, 3);
});

test('finalized plan records writer outcomes but never manufactures merge evidence', () => {
  const base = buildReconciliationPlan({
    ready: [pr(1), pr(2)],
    scopeByPr: scopes([[1, ['apps/rinne/src/a.js']], [2, ['apps/village/src/a.js']]]),
  });
  const final = finalizeReconciliationPlan(base, {
    merged: [{ pr:1, head:head(1), merge:'f'.repeat(40) }],
    held: [{ pr:2, head:head(2), reason:'current head fast gate or another check is not successful' }],
    deferred: [],
    retry: false,
  });
  assert.deepEqual(final.merged.map(item => item.pr), [1]);
  assert.equal(final.writer[0].pr, 2);
  assert.equal(final.writer[0].outcome, 'held');
  assert.equal(final.counts.merged, 1);
});

test('workflow topology makes reconciliation the planner, Rescue only a repair executor, and writer serialized', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const rescue = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  assert.match(controller, /Reconcile current GitHub reality/);
  assert.match(controller, /Serialized expected-head writer/);
  assert.match(controller, /Validate planned Virtual Integration Train/);
  assert.match(controller, /Repair executor pool/);
  assert.match(controller, /INTEGRATION_PREFLIGHT_CONCURRENCY: '6'/);
  assert.doesNotMatch(rescue, /Validate Virtual Integration Train/);
  assert.match(rescue, /Integration Repair Executors/);
  assert.match(rescue, /Repair PR \$\{\{ matrix\.pr \}\}/);
});

test('PULSE exposes planner lanes instead of only one backlog number', () => {
  const server = readFileSync('ops-board/rescue.mjs', 'utf8');
  const client = readFileSync('ops-board/public/flow-board.js', 'utf8');
  assert.match(server, /reconciliationView/);
  assert.match(server, /actionableIdle/);
  assert.match(client, /writer/);
  assert.match(client, /repair/);
  assert.match(client, /blocked/);
  assert.match(client, /次のreconcileで再配分/);
  assert.doesNotMatch(client, /innerHTML/);
});
