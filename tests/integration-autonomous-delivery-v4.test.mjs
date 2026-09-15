import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { failureFingerprint, refreshFailureKnowledge, bestKnownPlaybook } from '../scripts/integration-failure-knowledge.mjs';
import { gateCostPlan } from '../scripts/integration-gate-cost.mjs';
import { chooseLastKnownGood, verifyLastKnownGood } from '../scripts/dev-last-known-good.mjs';
import { candidatePath } from '../scripts/dev-candidate-server.mjs';
import { supersededNumbers } from '../scripts/integration-control-consolidation.mjs';
import { adaptiveFlowTuning, deliveryLatencyMetrics } from '../scripts/integration-flow-control.mjs';
import { evaluateCanary } from '../scripts/integration-control-canary.mjs';

const sha = c => c.repeat(40);

test('failure fingerprints normalize exact-head noise and expose bounded safe playbooks', () => {
  const a = failureFingerprint(`HEAD_CHANGED from ${sha('a')} to ${sha('b')}`);
  const b = failureFingerprint(`HEAD_CHANGED from ${sha('c')} to ${sha('d')}`);
  assert.equal(a.kind, 'stale-head');
  assert.equal(a.id, b.id);
  assert.ok(a.playbook.some(line => /stale evidence/i.test(line)));
});

test('failure knowledge is bounded and successful repairs increase prior evidence instead of manufacturing success', () => {
  const state = { records: {
    1: { pr:1, state:'RETURNED_TO_INTEGRATION', returnedAt:'2026-09-14T10:00:00Z', failures:[{ at:'2026-09-14T09:00:00Z', reason:'VALIDATION_FAILED: unit' }] },
  } };
  refreshFailureKnowledge(state, Date.parse('2026-09-14T10:01:00Z'));
  const learned = bestKnownPlaybook(state, 'VALIDATION_FAILED: unit');
  assert.equal(learned.learned.successfulRepairs, 1);
  assert.equal(learned.learned.count, 1);
});

test('gate cost optimizer only reorders cheap checks and never omits fast/browser from final workflow contract', () => {
  const control = gateCostPlan(['scripts/integration.mjs','.github/workflows/deploy.yml']);
  const browser = gateCostPlan(['ops-board/public/flow-board.js','ops-board/public/flow-board.css']);
  assert.equal(control.order[0], 'diff-check');
  assert.ok(control.order.includes('fast'));
  assert.ok(browser.order.includes('browser'));
});

test('LKG selection requires same naming contract, another exact SHA and workflow-run identity', () => {
  const current = sha('a');
  const artifacts = [
    { id:1,name:`dev-lkg-site-${current}`,expired:false,created_at:'2026-09-14T10:00:00Z',workflow_run:{id:101} },
    { id:2,name:`dev-lkg-site-${sha('b')}`,expired:false,created_at:'2026-09-14T09:00:00Z',workflow_run:{id:99} },
    { id:3,name:`dev-lkg-site-${sha('c')}`,expired:false,created_at:'2026-09-14T08:00:00Z' },
    { id:4,name:'other-artifact',expired:false,created_at:'2026-09-14T11:00:00Z',workflow_run:{id:102} },
  ];
  const selected = chooseLastKnownGood(artifacts, current);
  assert.equal(selected.id, 2);
  assert.equal(selected.runId, 99);
  assert.equal(selected.sourceSha, sha('b'));
});

test('LKG verification refuses an artifact whose manifest identifies another DEV commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'rinne-lkg-'));
  try {
    writeFileSync(join(root, 'deployment-manifest.json'), JSON.stringify({
      schemaVersion:1, validatedDevelop:sha('b'), environmentSnapshots:{dev:{commit:sha('b')}}, entries:[],
    }));
    assert.deepEqual(verifyLastKnownGood(root, sha('b')), { sourceSha:sha('b'), entries:0 });
    assert.throws(() => verifyLastKnownGood(root, sha('c')), /manifest must match/);
  } finally { rmSync(root, { recursive:true, force:true }); }
});

test('candidate server path mapping preserves repository mount and rejects traversal', () => {
  const root = '/tmp/site-root';
  assert.equal(candidatePath(root, '/soul-lineage/dev/rinne/index.html'), '/tmp/site-root/dev/rinne/index.html');
  assert.throws(() => candidatePath(root, '/soul-lineage/%2e%2e/escape'), /PATH_ESCAPE/);
});

test('control-plane consolidation requires explicit Supersedes declarations', () => {
  assert.deepEqual(supersededNumbers('Supersedes: #223 #225\nDepends-On: none'), [223,225]);
  assert.deepEqual(supersededNumbers('Supersedes: #223, #223, #225'), [223,225]);
  assert.deepEqual(supersededNumbers('similar to #223'), []);
});

test('adaptive throughput remains bounded from normal operation through burn-down', () => {
  const normal = adaptiveFlowTuning({ ready:2, latency:deliveryLatencyMetrics([]), failureRate:0, rateRemaining:1000 });
  const busy = adaptiveFlowTuning({ ready:7, latency:{implementationToDev:{p95Ms:12*60000}}, failureRate:0, rateRemaining:1000 });
  const burn = adaptiveFlowTuning({ ready:14, latency:{implementationToDev:{p95Ms:25*60000}}, failureRate:0, rateRemaining:1000 });
  const unstable = adaptiveFlowTuning({ ready:14, failureRate:.3, rateRemaining:1000 });
  assert.deepEqual([normal.trainSize,normal.rescueConcurrency,normal.maxEvaluations],[3,4,16]);
  assert.deepEqual([busy.trainSize,busy.rescueConcurrency,busy.maxEvaluations],[4,5,20]);
  assert.deepEqual([burn.trainSize,burn.rescueConcurrency,burn.maxEvaluations],[5,6,24]);
  assert.deepEqual([unstable.trainSize,unstable.rescueConcurrency,unstable.maxEvaluations],[2,3,12]);
});

test('control canary treats notification as advisory while preserving delivery gates', () => {
  const head = sha('a');
  const base = {
    sha: head,
    manifest: { validatedDevelop: head },
    pulse: { repository: 'charukun/soul-lineage', generatedAt: '2026-09-15T00:00:00Z' },
    statuses: [
      { context: 'integration/develop', state: 'success' },
      { context: 'ops-board/public', state: 'success' },
      { context: 'notification/ntfy', state: 'error' },
    ],
  };
  const advisory = evaluateCanary(base);
  assert.equal(advisory.ok, true);
  assert.equal(advisory.checks.notification, false);
  assert.equal(advisory.advisory.notification, false);
  const broken = evaluateCanary({ ...base, statuses: [{ context: 'integration/develop', state: 'failure' }, { context: 'ops-board/public', state: 'success' }] });
  assert.equal(broken.ok, false);
});

test('workflow contracts keep exact-head fast merge, asynchronous browser repair, DEV verification, LKG fallback and no paid model API', async () => {
  const { readFileSync } = await import('node:fs');
  const ci = readFileSync('.github/workflows/ci.yml','utf8');
  const deploy = readFileSync('.github/workflows/deploy.yml','utf8');
  const controller = readFileSync('.github/workflows/integration-controller.yml','utf8');
  const coalescer = readFileSync('.github/workflows/dev-publisher-coalescer.yml','utf8');
  const rescue = readFileSync('.github/workflows/integration-rescue.yml','utf8');
  assert.match(ci,/Validate and build/);
  assert.match(ci,/Affected browser smoke/);
  assert.match(ci,/integration-stack-ci\.mjs/);
  assert.match(ci,/integration-gate-cost\.mjs/);
  assert.match(ci,/integration-request:[\s\S]*needs: \[readiness, build\]/);
  assert.doesNotMatch(ci,/integration-request:[\s\S]*needs: \[readiness, build, browser\]/);
  assert.match(deploy,/Validate exact DEV candidate before public promotion/);
  assert.match(deploy,/Promote candidate to DEV Pages/);
  assert.match(deploy,/Restore Last Known Good DEV/);
  assert.match(deploy,/integration\/dev-fallback/);
  assert.match(controller,/integration-controller-develop/);
  assert.match(controller,/Integration Fast Lane/);
  assert.match(controller,/integration-fast-lane\.mjs/);
  assert.doesNotMatch(controller,/Validate planned Virtual Integration Train/);
  assert.doesNotMatch(controller,/publisher-handoff:/);
  assert.match(coalescer,/run\.event === 'push' && run\.head_sha !== latestSha/);
  assert.match(rescue,/Observe repair pressure and knowledge/);
  assert.match(rescue,/Plan repair executor wave/);
  assert.doesNotMatch(`${ci}\n${deploy}\n${controller}\n${coalescer}\n${rescue}`,/OPENAI_API_KEY|openai\/codex-action|RINNE_CODEX_MODEL/);
});
