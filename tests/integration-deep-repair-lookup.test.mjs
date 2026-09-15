import test from 'node:test';
import assert from 'node:assert/strict';
import { deepRepairIssueMarker, deepRepairIssueState } from '../scripts/integration-deep-repair-handoff.mjs';
import { findDeepRepairIssue } from '../scripts/integration-deep-repair-lookup.mjs';

const repository = 'charukun/soul-lineage';
const head = 'a'.repeat(40), develop = 'b'.repeat(40);
const pr = { number: 329, head: { sha: head, ref: 'fix/pulse' } };
const issue = (number, values = {}, fields = {}) => ({
  number, state: 'open', ...fields,
  body: deepRepairIssueMarker({ ...deepRepairIssueState({ pr, develop, reason: 'CI_FAILURE' }), ...values }),
});

function fixture({ indexed = [], recent = [], current = [], statuses = [], searchFields = {} } = {}) {
  const calls = [];
  const c = {
    root: `/repos/${repository}`,
    async pages(path) {
      calls.push(path);
      assert.equal(path, `/commits/${head}/statuses`);
      return statuses;
    },
    async api(method, path) {
      assert.equal(method, 'GET'); calls.push(path);
      if (path.startsWith('/search/issues?')) {
        const query = new URL(`https://api.github.com${path}`).searchParams.get('q');
        assert.ok(query.includes(`repo:${repository}`) && query.includes('is:issue') && query.includes(`"${head}"`));
        return { incomplete_results: false, total_count: indexed.length, items: indexed, ...searchFields };
      }
      if (path === `${c.root}/issues?state=open&sort=created&direction=desc&per_page=100`) return recent;
      const found = current.find(item => path === `${c.root}/issues/${item.number}`);
      if (found) return found;
      throw new Error(`Unexpected request ${path}`);
    },
  };
  return { c, calls };
}

test('repair lookup does not enumerate repository-wide history beyond 300 PRs/issues', async () => {
  const unrelatedHistory = Array.from({ length: 5000 }, (_, i) => ({ number: i + 1, body: 'ordinary PR', pull_request: {} }));
  const expected = issue(10);
  const f = fixture({ indexed: [expected], recent: unrelatedHistory.slice(-100), current: [expected] });
  assert.equal((await findDeepRepairIssue(f.c, { repository, pr })).number, 10);
  assert.equal(f.calls.length, 4);
  assert.ok(!f.calls.some(path => path.includes('state=all') || /[?&]page=/.test(path)));
});

test('recent open ticket covers indexing delay before a receipt exists', async () => {
  const expected = issue(351);
  const f = fixture({ recent: [expected], current: [expected] });
  assert.equal((await findDeepRepairIssue(f.c, { repository, pr })).number, 351);
});

test('receipt locates an unindexed closed ticket and reads its current terminal state', async () => {
  const expected = issue(301, { state: 'human-required', attempt: 1 }, { state: 'closed' });
  const f = fixture({ current: [expected], statuses: [{ context: 'integration/deep-repair', target_url: `https://github.com/${repository}/issues/301` }] });
  assert.deepEqual(await findDeepRepairIssue(f.c, { repository, pr }), expected);
});

test('current Issue body wins over stale search results and preserves terminal decisions across duplicates', async () => {
  const indexed = [issue(301), issue(323)];
  const expected = issue(301, { state: 'human-required', attempt: 1 });
  const f = fixture({ indexed, current: [expected, indexed[1]] });
  assert.deepEqual(await findDeepRepairIssue(f.c, { repository, pr }), expected);
});

test('working claim wins over pending duplicates and closure of an unclaimed duplicate', async () => {
  const indexed = [issue(10, {}, { state: 'closed' }), issue(11), issue(12, { state: 'working', attempt: 1 })];
  const f = fixture({ indexed, current: indexed });
  assert.equal((await findDeepRepairIssue(f.c, { repository, pr })).number, 12);
});

test('an incomplete or capped search is never treated as absence', async () => {
  for (const searchFields of [{ incomplete_results: true }, { total_count: 101 }, { items: null }, { total_count: -1 }]) {
    const f = fixture({ searchFields });
    await assert.rejects(findDeepRepairIssue(f.c, { repository, pr }), /INCOMPLETE_DEEP_REPAIR_SEARCH/);
  }
});

test('foreign receipt, false-positive head and PR records cannot become repair tickets', async () => {
  const wrong = issue(20, { head: 'c'.repeat(40) });
  const isPr = issue(21, {}, { pull_request: {} });
  const f = fixture({ indexed: [wrong, isPr], recent: [wrong, isPr], statuses: [{
    context: 'integration/deep-repair', target_url: 'https://github.com/another/repo/issues/301',
  }] });
  assert.equal(await findDeepRepairIssue(f.c, { repository, pr }), null);
  assert.ok(!f.calls.some(path => /\/issues\/\d+$/.test(path)));
});
