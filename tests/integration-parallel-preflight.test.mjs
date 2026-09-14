import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conflictScope } from '../scripts/integration-rescue-policy.mjs';
import { mapWithConcurrency, primeParallelIntegrationPreflight } from '../scripts/integration-parallel-preflight.mjs';

const repository = 'charukun/soul-lineage';
const develop = 'd'.repeat(40);
const head = n => String(n).padStart(40, String(n % 10));
const pr = (number, file) => ({
  number,
  state: 'open',
  draft: false,
  title: `PR ${number}`,
  body: 'Depends-On: none',
  author_association: 'OWNER',
  head: { sha: head(number), ref: `feat/${number}`, repo: { full_name: repository } },
  base: { ref: 'develop', repo: { full_name: repository } },
  file,
  created_at: new Date(1700000000000 + number).toISOString(),
});

function fakeClient(open) {
  return {
    root: `/repos/${repository}`,
    async api(method, path) {
      assert.equal(method, 'GET');
      if (path.endsWith('/branches/develop')) return { commit: { sha: develop } };
      throw new Error(`unexpected api ${path}`);
    },
    async pages(path) {
      assert.match(path, /pulls\?state=open&base=develop/);
      return open;
    },
  };
}

test('parallel mapper never exceeds the configured six-worker preparation lane', async () => {
  let active = 0, peak = 0;
  const settled = await mapWithConcurrency([...Array(12).keys()], 6, async value => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });
  assert.equal(peak, 6);
  assert.deepEqual(settled.map(item => item.value), [...Array(12).keys()].map(value => value * 2));
  await assert.rejects(() => mapWithConcurrency([1], 7, async value => value), /expected 1\.\.6/);
});

test('parallel preflight prepares independent PRs as one batch but keeps related scopes out', async () => {
  const open = [
    pr(11, 'apps/village/src/a.js'),
    pr(12, 'apps/demon/src/a.js'),
    pr(13, 'apps/village/src/b.js'),
    pr(14, 'apps/rinne/src/a.js'),
  ];
  let active = 0, peak = 0;
  const report = await primeParallelIntegrationPreflight(fakeClient(open), repository, {
    concurrency: 3,
    maxCandidates: 4,
    warmCandidate: async (_c, _repo, base, snapshot) => {
      assert.equal(base, develop);
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 4));
      active--;
      return {
        pr: snapshot.number,
        head: snapshot.head.sha,
        title: snapshot.title,
        body: snapshot.body,
        prSnapshot: snapshot,
        checksPassed: true,
        reviewCount: 0,
        mergeBase: develop,
        scope: conflictScope([snapshot.file], snapshot.body),
      };
    },
  });
  assert.equal(report.enabled, true);
  assert.equal(peak, 3);
  assert.deepEqual(report.candidates, [11, 12, 13, 14]);
  assert.deepEqual(report.batch, [11, 12, 14], 'same app/package different file is YELLOW and stays outside the independent batch');
  assert.equal(report.warmed.length, 4);
  assert.deepEqual(report.failed, []);
});

test('preflight failures are diagnostic only and never manufacture merge eligibility', async () => {
  const open = [pr(21, 'apps/village/src/a.js'), pr(22, 'apps/demon/src/a.js')];
  const report = await primeParallelIntegrationPreflight(fakeClient(open), repository, {
    concurrency: 2,
    warmCandidate: async (_c, _repo, _base, snapshot) => {
      if (snapshot.number === 22) throw new Error('GitHub HTTP 502');
      return {
        pr: snapshot.number,
        head: snapshot.head.sha,
        title: snapshot.title,
        body: snapshot.body,
        prSnapshot: snapshot,
        checksPassed: true,
        reviewCount: 0,
        mergeBase: develop,
        scope: conflictScope([snapshot.file], snapshot.body),
      };
    },
  });
  assert.deepEqual(report.batch, [21]);
  assert.deepEqual(report.failed, [{ pr: 22, reason: 'GitHub HTTP 502' }]);
});

test('controller primes immutable expensive evidence before authoritative serial Integration', () => {
  const source = readFileSync('scripts/integration-controller.mjs', 'utf8');
  assert.match(source, /primeParallelIntegrationPreflight/);
  assert.ok(source.indexOf('primeParallelIntegrationPreflight') < source.indexOf('const report = await integrate'));
  assert.match(source, /INTEGRATION_PREFLIGHT_CONCURRENCY \|\| 6/);
  assert.doesNotMatch(source, /Promise\.all\([^\n]*pulls\/[^\n]*merge/);
});
