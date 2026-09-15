import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exactHeadFastFailure } from '../scripts/integration-ci-failure.mjs';
import { integrateFastLane } from '../scripts/integration-fast-lane.mjs';
import { deepRepairIssueMarker, deepRepairIssueState, parseDeepRepairIssue, signalDeepRepair } from '../scripts/integration-deep-repair-handoff.mjs';

const repository = 'charukun/soul-lineage';
const head = 'a'.repeat(40), develop = 'b'.repeat(40), otherHead = 'c'.repeat(40);
const pr = {
  number: 336, state: 'open', draft: false, author_association: 'OWNER',
  body: 'Depends-On: none', labels: [], mergeable: true, mergeable_state: 'unstable',
  html_url: `https://github.com/${repository}/pull/336`,
  head: { sha: head, ref: 'fix/combat', repo: { full_name: repository } },
  base: { ref: 'develop', repo: { full_name: repository } },
};
const run = (id = 11, values = {}) => ({
  id, run_attempt: 1, status: 'in_progress', event: 'pull_request',
  head_sha: head, head_branch: pr.head.ref, head_repository: pr.head.repo,
  display_title: `CI validation #336 ${head}`, ...values,
});
const job = (values = {}) => ({
  id: 101, name: 'Validate and build', status: 'completed', conclusion: 'failure',
  head_sha: head, run_attempt: 1, ...values,
});

function fixture({ runs = [run()], jobs = [job()], independent = false, fresh = {}, reviews = [], unresolved = false, overlap = false } = {}) {
  const writes = [], issues = [];
  const other = { ...pr, number: 337, head: { ...pr.head, sha: otherHead, ref: 'fix/independent' }, mergeable_state: 'clean' };
  let currentDevelop = develop;
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      if (path.startsWith('/pulls?')) return independent ? [pr, other] : [pr];
      if (path.startsWith('/issues?')) return issues;
      if (path.startsWith('/actions/workflows/ci.yml/runs')) return path.includes(otherHead)
        ? [run(22, { head_sha: otherHead, head_branch: other.head.ref })] : runs;
      if (path.endsWith('/statuses')) return [];
      if (path.endsWith('/reviews')) return path.includes('/337/') ? [] : reviews;
      if (path.endsWith('/files')) return [{ filename: 'packages/raid/group-session.js' }];
      if (path === '/actions/runs/22/artifacts') return [{ name: `pr-fast-337-${otherHead}`, expired: false }];
      if (path.endsWith('/artifacts')) return overlap ? [{ name: `pr-fast-336-${head}`, expired: false }] : [];
      if (path === '/actions/runs/22/jobs?filter=latest') return [job({ head_sha: otherHead, conclusion: 'success' })];
      if (path.endsWith('/jobs?filter=latest')) return jobs;
      throw new Error(`Unexpected pages ${path}`);
    },
    async api(method, path, body) {
      if (method === 'GET' && path.startsWith('/search/issues?')) return { items: issues, total_count: issues.length, incomplete_results: false };
      if (method === 'GET' && path.includes('/issues?state=open')) return issues.filter(issue => issue.state !== 'closed');
      if (method === 'GET' && /\/issues\/\d+$/.test(path)) return issues.find(issue => path.endsWith(`/issues/${issue.number}`));
      if (method === 'GET' && path.endsWith('/branches/develop')) return { commit: { sha: currentDevelop } };
      if (method === 'GET' && path.endsWith('/pulls/336')) {
        this.prReads = (this.prReads || 0) + 1;
        return this.prReads > 1 ? { ...pr, ...fresh } : pr;
      }
      if (method === 'GET' && path.endsWith('/pulls/337')) return other;
      if (method === 'GET' && path.includes('/compare/')) {
        const oldBase = 'e'.repeat(40);
        if (overlap && path.endsWith(`...${head}`)) return { merge_base_commit: { sha: oldBase } };
        if (overlap && path.endsWith(`/compare/${oldBase}...${currentDevelop}`)) return { merge_base_commit: { sha: oldBase }, files: [{ filename: 'packages/raid/new-feature.js' }] };
        return { merge_base_commit: { sha: currentDevelop } };
      }
      if (path === '/graphql') return { data: { repository: { pullRequest: { reviewThreads: {
        nodes: body.variables.number === 336 && unresolved ? [{ isResolved: false }] : [],
        pageInfo: { hasNextPage: false },
      } } } } };
      writes.push({ method, path, body });
      if (method === 'POST' && path.endsWith('/issues')) {
        const issue = { number: 601, html_url: `https://github.com/${repository}/issues/601`, state: 'open', body: body.body };
        issues.push(issue); return issue;
      }
      if (method === 'POST' && path.includes('/statuses/')) return {};
      if (method === 'PUT' && path.endsWith('/pulls/337/merge')) {
        currentDevelop = 'd'.repeat(40); return { merged: true, sha: currentDevelop };
      }
      throw new Error(`Unexpected ${method} ${path}`);
    },
  };
  return { c, writes, issues };
}

test('completed fast failure is repair evidence while its own Integration wake is still running', async () => {
  const { c } = fixture();
  assert.deepEqual(await exactHeadFastFailure(c, pr), {
    head, runId: 11, runAttempt: 1, jobId: 101, jobName: 'Validate and build', conclusion: 'failure',
    runUrl: `https://github.com/${repository}/actions/runs/11`,
    jobUrl: `https://github.com/${repository}/actions/runs/11/job/101`,
  });
});

test('observation success cannot hide the newest validation failure', async () => {
  const { c } = fixture({ runs: [run(12, { display_title: 'CI observation #336', status: 'completed' }), run()] });
  assert.equal((await exactHeadFastFailure(c, pr)).runId, 11);
});

test('old heads, foreign sources, Draft/skipped jobs and active reruns are never failed-source evidence', async () => {
  const cases = [
    { runs: [run(11, { head_sha: otherHead })] },
    { runs: [run(11, { head_branch: 'another/branch' })] },
    { runs: [run(11, { head_repository: { full_name: 'external/fork' } })] },
    { runs: [run(11, { event: 'push' })] },
    { jobs: [job({ name: 'Draft lightweight check' })] },
    { jobs: [job({ conclusion: 'skipped' })] },
    { jobs: [job({ conclusion: 'cancelled' })] },
    { jobs: [job({ status: 'in_progress', conclusion: null })] },
    { jobs: [job({ head_sha: otherHead })] },
    { runs: [run(11, { run_attempt: 2 })], jobs: [job({ run_attempt: 1 })] },
    { runs: [run(11, { status: 'queued' })] },
    { runs: [run(12), run()], jobs: [job({ conclusion: 'success' })] },
    { jobs: [job({ conclusion: 'success' }), job({ name: 'Affected browser smoke' })] },
  ];
  for (const config of cases) assert.equal(await exactHeadFastFailure(fixture(config).c, pr), null, JSON.stringify(config));
  assert.equal((await exactHeadFastFailure(fixture({ jobs: [job({ conclusion: 'timed_out' })] }).c, pr)).conclusion, 'timed_out');
});

test('Fast Lane hands CI failure to one exact-head issue and still merges an independent good PR', async () => {
  const f = fixture({ independent: true });
  const report = await integrateFastLane(f.c, repository, { wait: async () => {} });
  assert.deepEqual(report.deepRepair.map(item => item.pr), [336]);
  assert.deepEqual(report.merged.map(item => item.pr), [337]);
  assert.equal(f.issues.length, 1);
  const state = parseDeepRepairIssue(f.issues[0].body);
  assert.equal(state.repairKind, 'ci-failure');
  assert.equal(state.ciFailure.jobId, 101);
  assert.equal(state.head, head); assert.equal(state.develop, develop);
  assert.equal(state.attempt, 0); assert.equal(state.maxAttempts, 2);
  assert.match(f.issues[0].body, /rinne-ai-repair:v1/);
  assert.ok(!f.writes.some(item => item.path.endsWith('/pulls/336/merge')));
});

test('repeated scans reuse the same pending repair ticket without resetting its claim', async () => {
  const f = fixture();
  await integrateFastLane(f.c, repository, { wait: async () => {} });
  const state = parseDeepRepairIssue(f.issues[0].body);
  state.state = 'working'; state.attempt = 1;
  f.issues[0].body = deepRepairIssueMarker(state);
  await integrateFastLane(f.c, repository, { wait: async () => {} });
  assert.equal(f.issues.length, 1);
  assert.equal(parseDeepRepairIssue(f.issues[0].body).attempt, 1);
});

test('handoff rechecks current head, Draft, hold, dependency, reviews and threads', async () => {
  const cases = [
    { fresh: { head: { ...pr.head, sha: otherHead } } },
    { fresh: { draft: true } },
    { fresh: { state: 'closed' } },
    { fresh: { base: { ...pr.base, ref: 'main' } } },
    { fresh: { head: { ...pr.head, repo: { full_name: 'external/fork' } } } },
    { fresh: { labels: [{ name: 'integration:hold' }] } },
    { fresh: { body: 'Integration-Hold: stop' } },
    { fresh: { body: 'Depends-On: #337' } },
    { reviews: [{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'reviewer' } }] },
    { unresolved: true },
  ];
  for (const config of cases) {
    const f = fixture(config);
    await integrateFastLane(f.c, repository, { wait: async () => {} });
    assert.equal(f.issues.length, 0, JSON.stringify(config));
    assert.ok(!f.writes.some(item => item.path.endsWith('/merge')));
  }
});

test('closed, exhausted and human-required tickets cannot be reopened as fresh attempts', async () => {
  for (const values of [{ state: 'human-required' }, { attempt: 2 }, { state: 'repaired', closed: true }]) {
    const f = fixture();
    f.issues.push({ number: 601, state: values.closed ? 'closed' : 'open', body: deepRepairIssueMarker({
      ...deepRepairIssueState({ pr, develop, reason: 'CI_FAILURE', repairKind: 'ci-failure' }), ...values,
    }) });
    const result = await signalDeepRepair(f.c, { pr, repository, develop, reason: 'CI_FAILURE',
      repairKind: 'ci-failure', dependenciesMerged: true, unresolved: false, reviews: [] });
    assert.equal(result.signaled, false); assert.equal(f.writes.length, 0);
  }
});

test('CI dispatch predicate wakes on build failure without waiting for browser or waking Draft/main/cancelled runs', () => {
  const block = readFileSync('.github/workflows/ci.yml', 'utf8').split('  integration-request:')[1].split('\n  browser:')[0];
  const expression = block.split('    if: >-\n')[1].split('    runs-on:')[0].trim();
  const evaluate = new Function('needs', 'github', 'always', 'cancelled', 'contains', 'fromJSON', `return (${expression});`);
  const github = { repository, event_name: 'pull_request', event: { action: 'ready_for_review', pull_request: { base: pr.base, head: pr.head } } };
  const check = (result, ready = 'true', event = github, cancelled = false) => evaluate(
    { build: { result }, readiness: { outputs: { ready } } }, event, () => true, () => cancelled,
    (list, item) => list.includes(item), JSON.parse);
  assert.equal(check('failure'), true); assert.equal(check('success'), true);
  assert.equal(check('skipped'), false); assert.equal(check('cancelled'), false);
  assert.equal(check('failure', 'false'), false); assert.equal(check('failure', 'true', github, true), false);
  assert.equal(check('failure', 'true', { ...github, event: { ...github.event, pull_request: { ...github.event.pull_request, base: { ref: 'main' } } } }), false);
  assert.doesNotMatch(block, /needs\.browser/);
});

// A green PR can still need source reconciliation after develop changes the same package.
test('green scope overlap enters existing Deep Repair and leaves an independent PR free to merge', async () => {
  const f = fixture({ overlap: true, jobs: [job({ conclusion: 'success' })], independent: true });
  const report = await integrateFastLane(f.c, repository, { wait: async () => {} });
  assert.deepEqual(report.deepRepair.map(item => item.pr), [336]);
  assert.deepEqual(report.merged.map(item => item.pr), [337]);
  const state = parseDeepRepairIssue(f.issues[0].body);
  assert.equal(state.repairKind, 'semantic');
  assert.match(state.reason, /^DEVELOP_OVERLAP:/);
  assert.equal(state.head, head); assert.equal(state.develop, develop);
  assert.equal(state.attempt, 0); assert.equal(state.maxAttempts, 2);
  assert.ok(!f.writes.some(item => item.path.endsWith('/pulls/336/merge') || item.path.endsWith('/reviews')));
});

test('overlap handoff rechecks head, Ready, holds, dependency and review objections', async () => {
  for (const config of [
    { fresh: { head: { ...pr.head, sha: otherHead } } },
    { fresh: { draft: true } }, { fresh: { state: 'closed' } },
    { fresh: { labels: [{ name: 'integration:hold' }] } },
    { fresh: { body: 'Depends-On: #337' } },
    { reviews: [{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'reviewer' } }] },
    { unresolved: true },
  ]) {
    const f = fixture({ overlap: true, jobs: [job({ conclusion: 'success' })], ...config });
    await integrateFastLane(f.c, repository, { wait: async () => {} });
    assert.equal(f.issues.length, 0, JSON.stringify(config));
    assert.ok(!f.writes.some(item => item.path.endsWith('/merge') || item.path.endsWith('/reviews')));
  }
});

test('overlap scans preserve active claims and terminal repair decisions', async () => {
  for (const values of [{ state: 'working', attempt: 1 }, { state: 'human-required' }, { attempt: 2 }, { closed: true }]) {
    const f = fixture({ overlap: true, jobs: [job({ conclusion: 'success' })] });
    const state = { ...deepRepairIssueState({ pr, develop, reason: 'DEVELOP_OVERLAP' }), ...values };
    f.issues.push({ number: 601, state: values.closed ? 'closed' : 'open', body: deepRepairIssueMarker(state) });
    await integrateFastLane(f.c, repository, { wait: async () => {} });
    assert.equal(f.issues.length, 1); assert.deepEqual(parseDeepRepairIssue(f.issues[0].body), state);
    assert.ok(!f.writes.some(item => item.path.endsWith('/merge') || item.path.endsWith('/reviews')));
  }
});
