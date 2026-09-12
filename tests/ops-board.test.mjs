import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  STALL_WARNING_MS,
  classifyPull,
  environmentDiff,
  parseMergePulls,
  publishedCommit,
} from '../ops-board/model.mjs';
import {
  STALE_DRAFT_MS,
  bodyLines,
  compactPull,
  githubPullState,
  splitPulls,
  targetAppsFromFiles,
} from '../ops-board/pulls.mjs';
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
  const dev = { historyComplete: true, reflectedPrs: [{ number: 3 }, { number: 2 }, { number: 1 }] };
  const prod = { historyComplete: true, reflectedPrs: [{ number: 1 }] };
  const diff = environmentDiff(dev, prod);
  assert.equal(diff.count, 2);
  assert.match(diff.label, /\+2 PR/);
  assert.deepEqual(diff.pulls.map(x => x.number), [3, 2]);
});

test('DEV vs Production diff fails closed while either public history is incomplete', () => {
  const diff = environmentDiff(
    { historyComplete: true, reflectedPrs: [{ number: 3 }] },
    { historyComplete: false, reflectedPrs: [] },
  );
  assert.equal(diff.count, null);
  assert.equal(diff.exact, false);
  assert.deepEqual(diff.pulls, []);
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

test('PR board reads title and detail from the first two body lines', () => {
  assert.deepEqual(bodyLines('MasterCharacter量産基盤の整備\nSendagaya_Shinoを基準モデル化\nthird'), {
    title: 'MasterCharacter量産基盤の整備',
    detail: 'Sendagaya_Shinoを基準モデル化',
  });
});

test('PR board uses only GitHub standard lifecycle states', () => {
  assert.equal(githubPullState({ merged_at: '2026-09-12T00:00:00Z', state: 'closed', draft: false }), 'Merged');
  assert.equal(githubPullState({ merged_at: null, state: 'closed', draft: false }), 'Closed');
  assert.equal(githubPullState({ merged_at: null, state: 'open', draft: true }), 'Draft');
  assert.equal(githubPullState({ merged_at: null, state: 'open', draft: false }), 'Ready');
});

test('stale Draft is a weak display hint after 12 hours', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  const old = new Date(now - STALE_DRAFT_MS - 1000).toISOString();
  const item = compactPull({ number: 7, title: 'fallback', body: 'Title\nDetail', state: 'open', draft: true, updated_at: old, html_url: 'https://github.com/x/y/pull/7', head: { ref: 'feat/x' } }, now);
  assert.equal(item.state, 'Draft');
  assert.equal(item.staleDraft, true);
});

test('Visual Review Lab is separated from ordinary implementation PRs', () => {
  const split = splitPulls([
    { number: 1, title: 'Normal', body: 'Normal title\nNormal detail', state: 'open', draft: true, updated_at: '2026-09-12T01:00:00Z', html_url: 'https://github.com/x/y/pull/1', head: { ref: 'feat/normal' } },
    { number: 2, title: 'Visual Review Lab', body: 'Review lab\nLong-lived preview', state: 'open', draft: true, updated_at: '2026-09-12T01:00:00Z', html_url: 'https://github.com/x/y/pull/2', head: { ref: 'work/visual-review-lab-v2' } },
  ], Date.parse('2026-09-12T02:00:00Z'));
  assert.deepEqual(split.normal.map(x => x.number), [1]);
  assert.deepEqual(split.visualReview.map(x => x.number), [2]);
});

test('changed file paths map to target applications deterministically', () => {
  assert.deepEqual(targetAppsFromFiles([
    'apps/rinne/src/main.js',
    'apps/village/src/main.js',
    'packages/network/src/index.js',
  ]).map(x => x.label), ['輪廻転焦', '村づくり', '共通基盤']);
  assert.deepEqual(targetAppsFromFiles(['README.md']).map(x => x.label), ['Repository共通']);
});

test('worker deployment URL parser only accepts the stable rinne-ops URL', () => {
  assert.equal(opsDeploymentUrl('Uploaded\nhttps://rinne-ops.c-okamoto.workers.dev\n'), 'https://rinne-ops.c-okamoto.workers.dev/');
  assert.throws(() => opsDeploymentUrl('https://example.workers.dev'));
});

test('public dashboard is compact, grouped, target-aware, and not installable as a PWA', async () => {
  const index = await readFile(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
  const appBoard = await readFile(new URL('../ops-board/public/app-board.js', import.meta.url), 'utf8');
  const pullBoard = await readFile(new URL('../ops-board/public/pull-board.js', import.meta.url), 'utf8');
  assert.match(index, /class="summary-grid"/);
  assert.match(index, /概要/);
  assert.match(index, /アプリ別の公開状況/);
  assert.doesNotMatch(index, /rel="manifest"/);
  assert.match(appBoard, /app-summary-card/);
  assert.match(appBoard, /ゲーム \/ 専用開発版/);
  assert.match(appBoard, /開発ツール/);
  assert.match(pullBoard, /pulls\/\$\{number\}\/files/);
  assert.match(pullBoard, /対象確認中/);
});
