import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fastGate, recoverCancelledCi } from '../scripts/integration.mjs';
import { recoverQueue } from '../scripts/integration-queue-recovery.mjs';
import { buildApplications } from '../ops-board/applications.mjs';

const repository = 'charukun/soul-lineage';
const sha = 'a'.repeat(40);
const app = { id: 15368, slug: 'github-actions' };
function fixture() {
  const pr = { number: 138, state: 'open', draft: false, labels: [], body: 'Depends-On: none', author_association: 'OWNER',
    head: { sha, ref: 'fix/village', repo: { full_name: repository } }, base: { ref: 'develop', repo: { full_name: repository } }, mergeable: true, mergeable_state: 'clean' };
  const run = { id: 100, head_sha: sha, head_branch: pr.head.ref, head_repository: pr.head.repo, event: 'pull_request', status: 'completed', conclusion: 'success', run_attempt: 1, check_suite_id: 10 };
  const f = { pr, runs: [run], run, statuses: [], reviews: [], unresolved: false,
    jobs: ['Validate and build', 'Affected browser smoke'].map((name, i) => ({ id: 1000 + i, name, status: 'completed', conclusion: 'success' })),
    checks: [], artifacts: [{ name: `pr-fast-138-${sha}`, expired: false }], posts: [], publicRuns: [] };
  f.c = { root: `/repos/${repository}`, async pages(path, key) {
    if (path.startsWith('/pulls?')) return [f.pr];
    if (path.includes('/ops-board.yml/')) return f.publicRuns;
    if (key === 'workflow_runs') return f.runs;
    if (key === 'jobs') return f.jobs;
    if (key === 'artifacts') return f.artifacts;
    if (key === 'check_runs') return f.checks;
    if (path.endsWith('/statuses')) return f.statuses;
    if (path.endsWith('/reviews')) return f.reviews;
    throw new Error(path);
  }, async api(method, path, body) {
    if (method === 'POST' && path !== '/graphql') { f.posts.push({ path, body }); return {}; }
    if (path.endsWith('/pulls/138')) return f.freshPr || f.pr;
    if (path.endsWith('/actions/runs/100')) return f.freshRun || f.run;
    if (path === '/graphql') return { data: { repository: { pullRequest: { reviewThreads: { nodes: f.unresolved ? [{ isResolved: false }] : [], pageInfo: { hasNextPage: false } } } } } };
    throw new Error(path);
  } };
  return f;
}

test('cancelled legacy PULSE deployment and public failure cannot poison successful game gates', async () => {
  const f = fixture();
  f.statuses = [{ context: 'ops-board/public', state: 'failure' }];
  f.publicRuns = [{ head_sha: sha, head_repository: f.pr.head.repo, path: '.github/workflows/ops-board.yml', check_suite_id: 20 }];
  f.checks = [{ id: 1, name: 'deploy', app, check_suite: { id: 20 }, status: 'completed', conclusion: 'cancelled' }];
  assert.equal(await fastGate(f.c, f.pr), true);
  f.checks[0].check_suite.id = 30;
  assert.equal(await fastGate(f.c, f.pr), false, 'unrelated deploy check is still required');
  f.checks[0].check_suite.id = 20; f.checks[0].name = 'PULSE verification'; f.checks[0].conclusion = 'failure';
  assert.equal(await fastGate(f.c, f.pr), false, 'feature PULSE validation remains a gate');
});

test('metadata/review skipped browser cannot mask a required cancelled, missing, or failed browser', async () => {
  const f = fixture();
  f.runs.unshift({ ...f.run, id: 101, event: 'pull_request_review', check_suite_id: 11 });
  f.runs.unshift({ ...f.run, id: 102, display_title: 'CI observation #138 head', check_suite_id: 12 });
  f.checks = [{ id: 3, name: 'Affected browser smoke', app, check_suite: { id: 12 }, status: 'completed', conclusion: 'skipped' }];
  assert.equal(await fastGate(f.c, f.pr), true);
  for (const conclusion of ['failure', 'cancelled', 'skipped']) {
    f.jobs[1].conclusion = conclusion;
    assert.equal(await fastGate(f.c, f.pr), false);
  }
  f.jobs.pop(); assert.equal(await fastGate(f.c, f.pr), false);
});

test('new failed validation and external status never reuse old successful evidence', async () => {
  const f = fixture();
  f.statuses = [{ context: 'security/scan', state: 'failure' }, { context: 'ops-board/public', state: 'failure' }];
  assert.equal(await fastGate(f.c, f.pr), false);
  f.statuses = []; f.jobs[0].conclusion = 'failure';
  assert.equal(await fastGate(f.c, f.pr), false);
  f.jobs[0].conclusion = 'success'; f.artifacts = [];
  assert.equal(await fastGate(f.c, f.pr), false);
});

test('interrupted current-head browser is rerun with downstream jobs and finite attempts', async () => {
  const f = fixture(); f.jobs[1].conclusion = 'cancelled'; f.run.conclusion = 'cancelled';
  assert.equal((await recoverCancelledCi(f.c, f.pr)).state, 'requested');
  assert.deepEqual(f.posts, [{ path: `/repos/${repository}/actions/jobs/1001/rerun`, body: undefined }]);
  f.run.run_attempt = 3; f.posts = [];
  assert.equal((await recoverCancelledCi(f.c, f.pr)).state, 'blocked'); assert.equal(f.posts.length, 0);
});

test('failure, active attempts, moved head, holds and review objections cannot be retried', async () => {
  for (const mutate of [
    f => f.jobs[0].conclusion = 'failure', f => f.run.status = 'in_progress',
    f => f.freshPr = { ...f.pr, head: { ...f.pr.head, sha: 'b'.repeat(40) } },
    f => f.pr.labels = [{ name: 'integration:hold' }], f => f.pr.draft = true,
    f => f.pr.mergeable = false, f => f.unresolved = true,
    f => f.reviews = [{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'owner' } }],
    f => f.freshRun = { ...f.run, status: 'in_progress' },
  ]) {
    const f = fixture(); f.jobs[1].conclusion = 'cancelled'; mutate(f);
    await recoverCancelledCi(f.c, f.pr); assert.equal(f.posts.length, 0, mutate.toString());
  }
});

test('external scan recovers missed Integration requests but never merges or edits branches', async () => {
  const f = fixture();
  f.statuses = [{ context: 'integration/queue', state: 'pending', description: 'Held: current head fast gate or another check is not successful' }];
  const report = await recoverQueue(f.c);
  assert.equal(report.dispatched, true);
  assert.deepEqual(f.posts, [{ path: `/repos/${repository}/actions/workflows/deploy.yml/dispatches`, body: { ref: 'develop' } }]);
  f.posts = []; f.statuses[0].description = 'Held: overlapping changes since PR base require Integration review';
  assert.equal((await recoverQueue(f.c)).dispatched, false); assert.equal(f.posts.length, 0);
});

test('watchdog reruns interrupted CI even when Integration request was skipped', async () => {
  const f = fixture(); f.jobs[1].conclusion = 'cancelled';
  const report = await recoverQueue(f.c);
  assert.equal(report.ciRecovery[0].state, 'requested'); assert.equal(report.dispatched, false);
  assert.equal(f.posts.length, 1); assert.match(f.posts[0].path, /jobs\/1001\/rerun$/);
});

test('PULSE feature runs cannot be shown as public publication', () => {
  const runs = [
    { name: 'Rinne Ops Board', head_branch: 'fix/x', head_sha: 'feature', status: 'completed', conclusion: 'success' },
    { name: 'Rinne Ops Board', head_branch: 'develop', head_sha: 'published', status: 'completed', conclusion: 'success' },
  ];
  assert.equal(buildApplications({}, [], runs).find(a => a.id === 'ops-board').targets[0].commit, 'published');
});

test('workflow contract separates observation/validation and develop-only public side effects', () => {
  const pulse = readFileSync('.github/workflows/ops-board.yml', 'utf8');
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const [verification, publication] = pulse.split('  deploy:');
  assert.doesNotMatch(verification, /secrets\.|statuses: write|wrangler@4 deploy/);
  assert.match(publication, /if: github.ref == 'refs\/heads\/develop'/);
  assert.match(publication, /Record public Ops Board status\n\s+if:.*!cancelled\(\)/);
  assert.match(pulse, /group: rinne-ops-board-\$\{\{ github.ref \}\}/);
  assert.match(ci, /group: ci-.*'validation' \|\| 'observation'/);
  assert.match(deploy, /queue-recovery:[\s\S]*?inputs.rescue_mode == 'scan'[\s\S]*?integration-queue-recovery.mjs/);
});

test('live PR readiness wins over stale event Draft data; moved/closed heads do not validate', async () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  const script = workflow.split('  readiness:')[1].split('  request-rescue:')[0].split('          script: |\n')[1];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const evaluate = new AsyncFunction('github', 'context', 'core', script);
  for (const [live, expected] of [
    [{ state: 'open', draft: false, head: { sha } }, { ready: true, draft: false }],
    [{ state: 'open', draft: true, head: { sha } }, { ready: false, draft: true }],
    [{ state: 'open', draft: false, head: { sha: 'new' } }, { ready: false, draft: false }],
    [{ state: 'closed', draft: false, head: { sha } }, { ready: false, draft: false }],
  ]) {
    const outputs = {};
    await evaluate({ rest: { pulls: { get: async () => ({ data: live }) } } },
      { repo: {}, payload: { pull_request: { number: 144, draft: true, head: { sha } } } },
      { setOutput: (name, value) => outputs[name] = value });
    assert.deepEqual(outputs, expected);
  }
});

test('PULSE CI display and failure history do not let observation success hide validation failure', async () => {
  const { classifyPull } = await import('../ops-board/model.mjs');
  const { actionProblems } = await import('../ops-board/review-model.mjs');
  const f = fixture();
  const common = { workflow_id: 1, head_sha: sha, head_branch: f.pr.head.ref, event: 'pull_request', status: 'completed' };
  const runs = [
    { ...common, id: 2, name: 'CI observation #138 head', conclusion: 'success' },
    { ...common, id: 1, name: 'CI validation #138 head', conclusion: 'failure' },
  ];
  assert.equal(classifyPull(f.pr, runs).stage, 'CI_FAILED');
  assert.equal(actionProblems(runs, [f.pr]).current[0].id, 1);
});
