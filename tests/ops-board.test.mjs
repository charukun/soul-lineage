import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STALL_WARNING_MS,
  classifyPull,
  environmentDiff,
  parseMergePulls,
  publishedCommit,
} from '../ops-board/model.mjs';
import { opsDeploymentUrl } from '../ops-board/deployment-url.mjs';

const mergeCommit = (number, title, date, sha = `merge-${number}`) => ({
  sha,
  commit: {
    message: `Merge pull request #${number} from charukun/feat-${number}\n\n${title}`,
    committer: { date },
  },
});

test('merge PR history uses GitHub merge commits and preserves merge metadata', () => {
  const pulls = parseMergePulls([
    mergeCommit(12, 'newer', '2026-09-12T00:02:00Z'),
    mergeCommit(11, 'older', '2026-09-12T00:01:00Z'),
    { sha: 'normal', commit: { message: 'chore: direct commit' } },
  ]);
  assert.deepEqual(pulls.map(x => x.number), [12, 11]);
  assert.equal(pulls[0].title, 'newer');
  assert.match(pulls[0].url, /pull\/12$/);
});

test('published commit prefers explicit deployment snapshot and fails closed for mixed legacy commits', () => {
  assert.deepEqual(publishedCommit({ environmentSnapshots: { dev: { commit: 'abc', deployedAt: '2026-09-12T00:00:00Z' } } }, 'dev'), {
    commit: 'abc', deployedAt: '2026-09-12T00:00:00Z', exact: true,
  });
  const mixed = publishedCommit({ entries: [
    { environment: 'prod', version: { commit: 'a' } },
    { environment: 'prod', version: { commit: 'b' } },
  ] }, 'prod');
  assert.equal(mixed.commit, null);
  assert.equal(mixed.exact, false);
});

test('DEV vs Production PR delta is an exact set difference', () => {
  const dev = { reflectedPrs: [{ number: 3 }, { number: 2 }, { number: 1 }] };
  const prod = { reflectedPrs: [{ number: 1 }] };
  const diff = environmentDiff(dev, prod);
  assert.equal(diff.count, 2);
  assert.match(diff.label, /\+2 PR/);
  assert.deepEqual(diff.pulls.map(x => x.number), [3, 2]);
});

test('ready PR with successful CI becomes red after the stall threshold', () => {
  const now = Date.parse('2026-09-12T01:00:00Z');
  const ciTime = new Date(now - STALL_WARNING_MS - 1000).toISOString();
  const pr = { number: 33, title: 'Ready PR', html_url: 'https://github.com/x/y/pull/33', draft: false, head: { sha: 'head' }, updated_at: ciTime };
  const runs = [{ name: 'CI', head_sha: 'head', status: 'completed', conclusion: 'success', updated_at: ciTime, created_at: ciTime, html_url: 'https://github.com/actions/1' }];
  const state = classifyPull(pr, runs, [], now);
  assert.equal(state.stage, 'MERGE_WAIT');
  assert.equal(state.warning, true);
  assert.equal(state.tone, 'danger');
});

test('worker deployment URL parser only accepts the stable rinne-ops URL', () => {
  assert.equal(opsDeploymentUrl('Uploaded\nhttps://rinne-ops.c-okamoto.workers.dev\n'), 'https://rinne-ops.c-okamoto.workers.dev/');
  assert.throws(() => opsDeploymentUrl('https://example.workers.dev'));
});
