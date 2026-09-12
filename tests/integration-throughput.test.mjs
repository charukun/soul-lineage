import test from 'node:test';
import assert from 'node:assert/strict';
import { client, integrate, maxReadyEvaluationsPerRun } from '../scripts/integration.mjs';

const repository = 'charukun/soul-lineage';
const headers = values => ({ get: key => values[String(key).toLowerCase()] ?? null });
const response = (status, payload, extra = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: headers(extra),
  async json() { return payload; },
  clone() { return this; },
  async text() { return typeof payload === 'string' ? payload : JSON.stringify(payload); },
});

test('run-local GET cache reuses immutable evaluation data', async () => {
  let calls = 0;
  const c = client(repository, 'token', async () => { calls++; return response(200, []); }, { wait: async () => {} });
  await c.pages('/commits/head/statuses', undefined, { cache: true, maxPages: 1 });
  await c.pages('/commits/head/statuses', undefined, { cache: true, maxPages: 1 });
  assert.equal(calls, 1);
  assert.equal(c.metrics().cacheHits, 1);
});

test('429 obeys retry policy and leaves throttle diagnostics', async () => {
  let calls = 0;
  const waits = [];
  const c = client(repository, 'token', async () => {
    calls++;
    if (calls === 1) return response(429, 'secondary limit', { 'retry-after': '0' });
    return response(200, []);
  }, { wait: async ms => waits.push(ms) });
  const data = await c.pages('/commits/head/statuses', undefined, { maxPages: 1 });
  assert.deepEqual(data, []);
  assert.equal(calls, 2);
  assert.equal(c.metrics().throttleResponses, 1);
  assert.equal(c.metrics().retries, 1);
  assert.deepEqual(waits, [0]);
});

test('explicit holds are prefiltered before expensive per-PR GitHub reads', async () => {
  const seen = [];
  const pr = {
    number: 7, state: 'open', draft: false, author_association: 'OWNER',
    body: 'Depends-On: none', labels: [{ name: 'integration:hold' }],
    base: { ref: 'develop', repo: { full_name: repository } },
    head: { sha: 'head', ref: 'work/7', repo: { full_name: repository } },
  };
  const c = {
    root: `/repos/${repository}`,
    async api(method, path) {
      seen.push(`${method} ${path}`);
      if (path.endsWith('/branches/develop')) return { commit: { sha: 'base' } };
      if (path.endsWith('/pulls/7')) return pr;
      throw new Error(`unexpected API ${method} ${path}`);
    },
    async pages(path) {
      seen.push(`PAGES ${path}`);
      if (path.startsWith('/commits/base/statuses')) return [{ context: 'integration/develop', state: 'success' }];
      if (path.startsWith('/pulls?')) return [pr];
      throw new Error(`unexpected pages ${path}`);
    },
  };
  const report = await integrate(c, repository);
  assert.equal(report.held[0].reason, 'explicit Integration hold');
  assert.ok(!seen.some(x => /pulls\/7/.test(x)));
  assert.ok(!seen.some(x => /check-runs|actions\/workflows|artifacts|reviews|compare/.test(x)));
});

test('expensive Ready evaluation is bounded even when the queue is large', async () => {
  const prs = Array.from({ length: maxReadyEvaluationsPerRun + 5 }, (_, index) => ({
    number: index + 1, state: 'open', draft: false, author_association: 'OWNER', mergeable: true, mergeable_state: 'clean',
    body: 'Depends-On: none', labels: [],
    base: { ref: 'develop', repo: { full_name: repository } },
    head: { sha: `${index + 1}`.padStart(40, 'a'), ref: `work/${index + 1}`, repo: { full_name: repository } },
  }));
  let detailReads = 0;
  const c = {
    root: `/repos/${repository}`,
    async api(method, path) {
      if (path.endsWith('/branches/develop')) return { commit: { sha: 'base' } };
      if (path === '/graphql') return { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } } } } };
      if (path.includes('/compare/')) return { merge_base_commit: { sha: 'base' }, files: [] };
      const number = Number(path.match(/\/pulls\/(\d+)/)?.[1]);
      if (number) { detailReads++; return prs[number - 1]; }
      throw new Error(`unexpected API ${method} ${path}`);
    },
    async pages(path, key) {
      if (path.startsWith('/commits/base/statuses')) return [{ context: 'integration/develop', state: 'success' }];
      if (path.startsWith('/pulls?')) return prs;
      if (path.endsWith('/files') || path.endsWith('/reviews')) return [];
      if (key === 'workflow_runs') return [];
      if (path.includes('/statuses')) return [];
      throw new Error(`unexpected pages ${path}`);
    },
  };
  const report = await integrate(c, repository, async () => {}, { runId: 0 });
  assert.equal(report.deferred.length, 5);
  assert.ok(detailReads <= maxReadyEvaluationsPerRun);
  assert.equal(report.retry, true);
});
