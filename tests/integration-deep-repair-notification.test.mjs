import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatRepairBundle,
  chatRepairIssueMarker,
  deepRepairIssueMarker,
  deepRepairIssueState,
  parseDeepRepairIssue,
  signalDeepRepair,
} from '../scripts/integration-deep-repair-handoff.mjs';

const repository = 'charukun/soul-lineage';
const head = 'a'.repeat(40);
const oldHead = 'c'.repeat(40);
const develop = 'b'.repeat(40);
const oldDevelop = 'd'.repeat(40);
const pr = {
  number: 236,
  state: 'open',
  draft: false,
  body: 'Depends-On: none',
  html_url: 'https://github.com/charukun/soul-lineage/pull/236',
  author_association: 'OWNER',
  labels: [],
  base: { ref: 'develop', repo: { full_name: repository } },
  head: { ref: 'fix/example', sha: head, repo: { full_name: repository } },
};
const safe = { pr, repository, dependenciesMerged: true, unresolved: false, reviews: [] };

function bodyFor(targetHead, targetDevelop = develop, values = {}) {
  const targetPr = { ...pr, head: { ...pr.head, sha: targetHead } };
  const state = { ...deepRepairIssueState({ pr: targetPr, develop: targetDevelop, reason: 'DEVELOP_OVERLAP' }), ...values };
  const bundle = chatRepairBundle({ repository, pr: targetPr, develop: targetDevelop, reason: 'DEVELOP_OVERLAP' });
  return `${deepRepairIssueMarker(state)}\n${chatRepairIssueMarker(bundle)}`;
}

function fixture(existing) {
  const calls = [];
  const c = {
    root: `/repos/${repository}`,
    async pages() { return []; },
    async api(method, path, body) {
      calls.push({ method, path, body });
      if (method === 'GET' && path.startsWith('/search/issues?')) {
        return { incomplete_results: false, total_count: 1, items: [existing] };
      }
      if (method === 'GET' && path.includes('/issues?state=open')) return [existing];
      if (method === 'GET' && path.endsWith(`/issues/${existing.number}`)) return existing;
      if (method === 'PATCH' && path.endsWith(`/issues/${existing.number}`)) {
        existing = { ...existing, ...body };
        return existing;
      }
      if (method === 'POST' && path.endsWith(`/statuses/${head}`)) return {};
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  return { c, calls };
}

function creationFixture() {
  const calls = [];
  const c = {
    root: `/repos/${repository}`,
    async pages() { return []; },
    async api(method, path, body) {
      calls.push({ method, path, body });
      if (method === 'GET' && path.startsWith('/search/issues?')) {
        return { incomplete_results: false, total_count: 0, items: [] };
      }
      if (method === 'GET' && path.includes('/issues?state=open')) return [];
      if (method === 'POST' && path === `/repos/${repository}/issues`) {
        return {
          number: 505,
          state: 'open',
          html_url: 'https://github.com/charukun/soul-lineage/issues/505',
          ...body,
        };
      }
      if (method === 'POST' && path.endsWith(`/statuses/${head}`)) return {};
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  return { c, calls };
}

test('first Chat Repair creation uses assignment as the single owner notification cause', async () => {
  const f = creationFixture();
  const result = await signalDeepRepair(f.c, { ...safe, develop, reason: 'DEVELOP_OVERLAP' });
  assert.equal(result.signaled, true);
  assert.equal(result.issue, 505);
  const create = f.calls.find(call => call.method === 'POST' && call.path === `/repos/${repository}/issues`);
  assert.ok(create);
  assert.deepEqual(create.body.assignees, ['charukun']);
  assert.doesNotMatch(create.body.body, /@charukun/);
  assert.match(create.body.body, /CHAT_REPAIR_REQUIRED/);
});

test('a new exact head refreshes the same Chat Repair issue without another owner notification', async () => {
  const existing = {
    number: 501,
    state: 'open',
    html_url: 'https://github.com/charukun/soul-lineage/issues/501',
    body: bodyFor(oldHead),
  };
  const f = fixture(existing);
  const result = await signalDeepRepair(f.c, { ...safe, develop, reason: 'DEVELOP_OVERLAP' });
  assert.equal(result.signaled, true);
  assert.equal(result.issue, 501);
  const patch = f.calls.find(call => call.method === 'PATCH');
  assert.ok(patch);
  assert.equal(Object.hasOwn(patch.body, 'assignees'), false);
  assert.doesNotMatch(patch.body.body, /@charukun/);
  assert.match(patch.body.body, /CHAT_REPAIR_REFRESHED/);
  const state = parseDeepRepairIssue(patch.body.body);
  assert.equal(state.sourceKey, `pr:236:head:${head}`);
  assert.equal(state.head, head);
});

test('develop movement refreshes a ready incident on the same source head without re-notifying', async () => {
  const existing = {
    number: 502,
    state: 'open',
    html_url: 'https://github.com/charukun/soul-lineage/issues/502',
    body: bodyFor(head, oldDevelop, { state: 'ready-for-integration', attempt: 1 }),
  };
  const f = fixture(existing);
  const result = await signalDeepRepair(f.c, { ...safe, develop, reason: 'DEVELOP_OVERLAP' });
  assert.equal(result.signaled, true);
  const patch = f.calls.find(call => call.method === 'PATCH');
  assert.ok(patch);
  assert.doesNotMatch(patch.body.body, /@charukun/);
  const state = parseDeepRepairIssue(patch.body.body);
  assert.equal(state.develop, develop);
  assert.equal(state.state, 'pending');
  assert.equal(state.attempt, 0);
});

test('human-required remains a hard stop across head changes', async () => {
  const existing = {
    number: 503,
    state: 'open',
    html_url: 'https://github.com/charukun/soul-lineage/issues/503',
    body: bodyFor(oldHead, develop, { state: 'human-required', attempt: 1 }),
  };
  const f = fixture(existing);
  const result = await signalDeepRepair(f.c, { ...safe, develop, reason: 'DEVELOP_OVERLAP' });
  assert.equal(result.signaled, false);
  assert.match(result.blocked, /human-required/);
  assert.equal(f.calls.some(call => call.method === 'PATCH'), false);
});

test('an active working claim is never overwritten by a later exact-head refresh', async () => {
  const existing = {
    number: 504,
    state: 'open',
    html_url: 'https://github.com/charukun/soul-lineage/issues/504',
    body: bodyFor(oldHead, develop, { state: 'working', attempt: 1 }),
  };
  const f = fixture(existing);
  const result = await signalDeepRepair(f.c, { ...safe, develop, reason: 'DEVELOP_OVERLAP' });
  assert.equal(result.signaled, false);
  assert.match(result.blocked, /working on the previous exact-head generation/);
  assert.equal(f.calls.some(call => call.method === 'PATCH'), false);
});
