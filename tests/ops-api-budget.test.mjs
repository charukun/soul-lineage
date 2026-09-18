import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGithubFailure, createGithubClient } from '../ops-board/github-client.mjs';
import { FULL_PULL_RECONCILE_MS, syncPullSnapshot } from '../ops-board/pull-snapshot.mjs';
import { enrichTargets } from '../ops-board/review-model.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    async get(key) { return map.get(key); },
    async put(key, value) {
      if (key && typeof key === 'object' && value === undefined) {
        for (const [entryKey, entryValue] of Object.entries(key)) map.set(entryKey, entryValue);
      } else map.set(key, value);
    },
    async delete(key) { map.delete(key); },
  };
}

const pr = (number, updatedAt, state = 'open') => ({
  number,
  title: `PR ${number}`,
  body: `PR ${number}\nDetail`,
  state,
  draft: false,
  merged_at: state === 'closed' ? updatedAt : null,
  closed_at: state === 'closed' ? updatedAt : null,
  created_at: updatedAt,
  updated_at: updatedAt,
  merge_commit_sha: null,
  html_url: `https://github.com/charukun/soul-lineage/pull/${number}`,
  head: { ref: `work/${number}`, sha: String(number).padStart(40, '0'), repo: { full_name: 'charukun/soul-lineage' } },
  base: { ref: 'develop', sha: 'a'.repeat(40) },
});

const page = (data, hasNext = false) => ({
  data,
  response: { headers: new Headers(hasNext ? { link: '<next>; rel="next"' } : {}) },
});

test('GitHub client refuses tokenless access before any network request', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const client = createGithubClient({ storage, fetchImpl: async () => { calls++; throw new Error('must not fetch'); } });
  await assert.rejects(client.get('/branches?per_page=100'), error => {
    assert.equal(error.authRequired, true);
    assert.equal(error.githubDiagnostic?.kind, 'auth-required');
    assert.match(error.message, /未認証APIへは接続しません/);
    return true;
  });
  assert.equal(calls, 0);
  assert.equal(client.requests, 0);
  assert.equal(client.maxRequests, 0);
  assert.equal(client.scope, 'auth-required');
  assert.equal(client.deepAllowed, false);
});

test('authenticated GitHub client serves short-lived TTL hits without spending another request', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const now = Date.parse('2026-09-15T09:00:00Z');
  const fetchImpl = async (_url, options) => {
    calls++;
    assert.match(options.headers.authorization, /^Bearer /);
    return new Response(JSON.stringify([{ name: 'develop' }]), {
      headers: { etag: '"branches-v1"', 'x-ratelimit-remaining': '1000' },
    });
  };
  const client = createGithubClient({ storage, token: 'test-token', fetchImpl, now: () => now });
  const first = await client.get('/branches?per_page=100', { maxAgeMs: 60_000 });
  const second = await client.get('/branches?per_page=100', { maxAgeMs: 60_000 });
  assert.deepEqual(second.data, first.data);
  assert.equal(calls, 1);
  assert.equal(client.requests, 1);
  assert.equal(client.cacheHits, 1);
  assert.equal(client.maxRequests, 32);
  assert.equal(client.scope, 'authenticated');
  assert.equal(client.deepAllowed, true);
});

test('permission 403 does not poison authenticated scope with rate-limit backoff', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return new Response(JSON.stringify({ message: 'Resource not accessible by integration' }), {
      status: 403,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '999',
        'x-ratelimit-used': '1',
        'x-ratelimit-resource': 'core',
      },
    });
  };
  const client = createGithubClient({ storage, token: 'test-token', fetchImpl });
  await assert.rejects(client.get('/branches?per_page=100'), error => {
    assert.equal(error.githubDiagnostic?.kind, 'permission');
    assert.equal(error.rateLimited, false);
    return true;
  });
  await assert.rejects(client.get('/branches?per_page=100'), error => error.githubDiagnostic?.kind === 'permission');
  assert.equal(calls, 2);
});

test('primary limit stores typed authenticated backoff and blocks the next request without another fetch', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const now = Date.parse('2026-09-15T09:00:00Z');
  const resetSeconds = Math.floor((now + 20 * 60_000) / 1000);
  const fetchImpl = async () => {
    calls++;
    return new Response(JSON.stringify({ message: 'API rate limit exceeded for test' }), {
      status: 403,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-used': '1000',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-reset': String(resetSeconds),
      },
    });
  };
  const client = createGithubClient({ storage, token: 'test-token', fetchImpl, now: () => now });
  await assert.rejects(client.get('/branches?per_page=100'), error => {
    assert.equal(error.githubDiagnostic?.kind, 'primary');
    assert.equal(error.githubDiagnostic?.remaining, 0);
    assert.equal(error.rateLimited, true);
    return true;
  });
  await assert.rejects(client.get('/actions/runs?per_page=100'), error => {
    assert.equal(error.githubDiagnostic?.kind, 'primary');
    assert.match(error.message, /再取得待ち/);
    return true;
  });
  assert.equal(calls, 1);
});

test('secondary limit is distinct even when primary remaining is nonzero', () => {
  const now = Date.parse('2026-09-15T09:00:00Z');
  const diagnostic = classifyGithubFailure({
    status: 429,
    headers: new Headers({
      'retry-after': '90',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4870',
      'x-ratelimit-used': '130',
      'x-ratelimit-resource': 'core',
    }),
    message: 'You have exceeded a secondary rate limit.',
    scope: 'authenticated',
    now,
  });
  assert.equal(diagnostic.kind, 'secondary');
  assert.equal(diagnostic.remaining, 4870);
  assert.equal(diagnostic.retryAfter, '90');
  assert.equal(diagnostic.retryAtMs, now + 90_000);
});

test('PR snapshot is incremental between bounded full reconciliations', async () => {
  const storage = memoryStorage();
  const t1 = '2026-09-15T08:01:00Z';
  const t2 = '2026-09-15T08:02:00Z';
  const t3 = '2026-09-15T08:03:00Z';
  const t4 = '2026-09-15T08:04:00Z';
  let phase = 'initial';
  const calls = [];
  const client = {
    async get(path) {
      calls.push({ phase, path });
      const pageNumber = Number(new URL(`https://example.test${path}`).searchParams.get('page'));
      if (phase === 'initial') return pageNumber === 1 ? page([pr(3, t3), pr(2, t2)], true) : page([pr(1, t1)]);
      if (phase === 'incremental') return page([pr(4, t4), pr(3, t3), pr(2, t2)], true);
      return page([pr(4, t4), pr(3, t3), pr(1, t1)]);
    },
  };

  const initialAt = Date.parse('2026-09-15T08:10:00Z');
  const initial = await syncPullSnapshot(client, storage, { now: initialAt });
  assert.equal(initial.mode, 'full');
  assert.equal(initial.pages, 2);
  assert.equal(initial.complete, true);
  assert.deepEqual(initial.pulls.map(item => item.number), [3, 2, 1]);

  phase = 'incremental';
  const incremental = await syncPullSnapshot(client, storage, { now: initialAt + 60_000 });
  assert.equal(incremental.mode, 'incremental');
  assert.equal(incremental.pages, 1);
  assert.equal(incremental.complete, true);
  assert.deepEqual(incremental.pulls.map(item => item.number), [4, 3, 2, 1]);

  phase = 'reconcile';
  const reconciled = await syncPullSnapshot(client, storage, { now: initialAt + FULL_PULL_RECONCILE_MS + 1 });
  assert.equal(reconciled.mode, 'full');
  assert.equal(reconciled.pages, 1);
  assert.equal(reconciled.complete, true);
  assert.deepEqual(reconciled.pulls.map(item => item.number), [4, 3, 1]);
  assert.equal(calls.filter(call => call.phase === 'incremental').length, 1);
});

test('historical PR rows never trigger new target-file API backfill', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const client = {
    available: 32,
    deepAllowed: true,
    async get() { calls++; throw new Error('historical target lookup must not run'); },
  };
  const result = await enrichTargets([pr(9, '2026-09-14T08:00:00Z', 'closed')], client, storage, 4);
  assert.equal(calls, 0);
  assert.equal(result.attempted, 0);
  assert.equal(result.pending, 0);
  assert.equal(result.unavailable, 0);
  assert.equal(result.pulls[0].targetAppsStatus, 'skipped');
});
