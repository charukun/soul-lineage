import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPulseState } from '../ops-board/refresh-client.mjs';

const NOW = Date.parse('2026-09-17T13:10:00Z');
const BUILD = 'a'.repeat(40);
const healthy = overrides => ({
  repository: 'charukun/soul-lineage',
  schemaVersion: 2,
  syncStatus: 'ok',
  generatedAt: new Date(NOW).toISOString(),
  buildCommit: BUILD,
  githubApi: { scope: 'authenticated', requests: 4, cacheHits: 2 },
  ...overrides,
});

const ok = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('shared refresh client refuses missing credentials before network access', async () => {
  let calls = 0;
  await assert.rejects(refreshPulseState({
    refreshToken: 'server-refresh',
    githubToken: '',
    fetchImpl: async () => { calls++; return ok(healthy()); },
  }), /GH_TOKEN/);
  assert.equal(calls, 0);
});

test('shared refresh client forwards both credentials and accepts only authenticated fresh state', async () => {
  let calls = 0;
  const state = await refreshPulseState({
    baseUrl: 'https://pulse.example.test/',
    refreshToken: 'server-refresh',
    githubToken: 'github-run-token',
    reason: 'deployment',
    expectedBuildCommit: BUILD,
    now: () => NOW,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(String(url), 'https://pulse.example.test/api/refresh');
      const headers = new Headers(options.headers);
      assert.equal(headers.get('authorization'), 'Bearer server-refresh');
      assert.equal(headers.get('x-ops-github-token'), 'github-run-token');
      assert.equal(headers.get('x-ops-refresh-reason'), 'deployment');
      return ok(healthy());
    },
  });
  assert.equal(calls, 1);
  assert.equal(state.githubApi.scope, 'authenticated');
});

test('shared refresh client retries bounded transient failures but not contract failures', async () => {
  let calls = 0;
  const sleeps = [];
  const state = await refreshPulseState({
    refreshToken: 'server-refresh',
    githubToken: 'github-run-token',
    now: () => NOW,
    sleep: async ms => sleeps.push(ms),
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return new Response('', { status: 503, headers: { 'retry-after': '0' } });
      return ok(healthy());
    },
  });
  assert.equal(state.syncStatus, 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [0]);

  calls = 0;
  await assert.rejects(refreshPulseState({
    refreshToken: 'server-refresh',
    githubToken: 'github-run-token',
    now: () => NOW,
    sleep: async () => assert.fail('contract failures must not retry'),
    fetchImpl: async () => { calls++; return ok(healthy({ githubApi: { scope: 'auth-required' } })); },
  }), /authenticated GitHub access/);
  assert.equal(calls, 1);
});

test('shared refresh client rejects stale or wrong-worker snapshots even after HTTP success', async () => {
  await assert.rejects(refreshPulseState({
    refreshToken: 'server-refresh',
    githubToken: 'github-run-token',
    expectedBuildCommit: BUILD,
    now: () => NOW,
    fetchImpl: async () => ok(healthy({ generatedAt: new Date(NOW - 11 * 60_000).toISOString() })),
  }), /stale/);

  await assert.rejects(refreshPulseState({
    refreshToken: 'server-refresh',
    githubToken: 'github-run-token',
    expectedBuildCommit: BUILD,
    now: () => NOW,
    fetchImpl: async () => ok(healthy({ buildCommit: 'b'.repeat(40) })),
  }), /does not match/);
});
