import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finalizeMergedDeepRepairs } from '../scripts/integration-deep-repair-finalize.mjs';
import { parseDeepRepairIssue } from '../scripts/integration-deep-repair-lookup.mjs';

const repository = 'charukun/soul-lineage';
const sourceHead = 'a'.repeat(40);
const secondSourceHead = 'b'.repeat(40);
const repairHead = 'c'.repeat(40);
const mergeCommit = 'd'.repeat(40);
const otherHead = 'e'.repeat(40);

function issue(number, state) {
  return {
    number,
    state: 'open',
    html_url: `https://github.com/charukun/soul-lineage/issues/${number}`,
    body: `<!-- integration-deep-repair:v1\n${JSON.stringify(state)}\n-->\nAI_DEEP_REPAIR_REQUIRED`,
  };
}

function repairState({ pr = 418, head = sourceHead, state = 'working', attempt = 1, maxAttempts = 2 } = {}) {
  return {
    schema: 1,
    sourceKey: `pr:${pr}:head:${head}`,
    state,
    attempt,
    maxAttempts,
    pr,
    branch: `fix/pr-${pr}`,
    head,
    develop: 'f'.repeat(40),
    repairKind: 'ci-failure',
    reason: 'CI_FAILURE: Validate and build failure',
  };
}

test('merged source PR finalizes old-head Deep Repair issues without clearing human-required', async () => {
  const working = issue(421, repairState());
  const readyAtLimit = issue(422, repairState({ head: secondSourceHead, state: 'ready-for-integration', attempt: 2 }));
  const human = issue(423, repairState({ head: '1'.repeat(40), state: 'human-required', attempt: 2 }));
  const unrelated = issue(424, repairState({ pr: 419, head: otherHead }));
  const all = [working, readyAtLimit, human, unrelated];
  const patches = [];
  const statuses = [];
  const calls = [];
  const c = {
    root: '/repos/charukun/soul-lineage',
    async pages() { throw new Error('pagination should not be needed for this fixture'); },
    async api(method, path, body) {
      calls.push({ method, path, body });
      if (method === 'GET' && path.startsWith('/search/issues?')) {
        return { items: all, total_count: all.length, incomplete_results: false };
      }
      if (method === 'GET' && path.includes('/issues?state=open')) return all;
      if (method === 'GET' && /\/issues\/\d+$/.test(path)) {
        return all.find(item => path.endsWith(`/issues/${item.number}`));
      }
      if (method === 'PATCH' && /\/issues\/\d+$/.test(path)) {
        patches.push({ path, body });
        return {};
      }
      if (method === 'POST' && path.includes('/statuses/')) {
        statuses.push({ path, body });
        return {};
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
  };

  const result = await finalizeMergedDeepRepairs(c, {
    repository,
    merges: [{ pr: 418, head: repairHead, merge: mergeCommit }],
    completedAt: '2026-09-15T19:19:34.000Z',
  });

  assert.deepEqual(result.finalized.map(item => item.issue).sort(), [421, 422]);
  assert.deepEqual(result.skipped, [{ issue: 423, pr: 418, state: 'human-required' }]);
  assert.equal(result.errors.length, 0);
  assert.equal(patches.length, 2);
  assert.equal(statuses.length, 2);
  assert.equal(calls.filter(call => call.method === 'GET' && call.path.startsWith('/search/issues?')).length, 1);

  for (const patch of patches) {
    assert.equal(patch.body.state, 'closed');
    assert.equal(patch.body.state_reason, 'completed');
    const state = parseDeepRepairIssue(patch.body.body);
    assert.equal(state.state, 'completed');
    assert.equal(state.repairHead, repairHead);
    assert.equal(state.mergeCommit, mergeCommit);
    assert.equal(state.completedAt, '2026-09-15T19:19:34.000Z');
    assert.match(patch.body.body, new RegExp(`integration-verified:${mergeCommit}`));
    assert.match(patch.body.body, /browser and DEV delivery remain separate results/);
  }
  assert.ok(statuses.some(item => item.path.endsWith(`/statuses/${sourceHead}`) && item.body.state === 'success'));
  assert.ok(statuses.some(item => item.path.endsWith(`/statuses/${secondSourceHead}`) && item.body.state === 'success'));
  assert.ok(!patches.some(item => item.path.endsWith('/issues/423')));
  assert.ok(!patches.some(item => item.path.endsWith('/issues/424')));
});

test('no merge batch performs no GitHub discovery', async () => {
  let called = false;
  const c = { async api() { called = true; }, async pages() { called = true; } };
  const result = await finalizeMergedDeepRepairs(c, { repository, merges: [] });
  assert.deepEqual(result, { finalized: [], skipped: [], errors: [] });
  assert.equal(called, false);
});

test('Integration runs finalization after Fast Lane and keeps it nonblocking before publication', () => {
  const workflow = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const merge = workflow.indexOf('id: fast-lane');
  const finalize = workflow.indexOf('Finalize Deep Repair issues for merged PRs');
  const publish = workflow.indexOf('Request latest DEV and PULSE publication without waiting');
  assert.ok(merge >= 0 && finalize > merge && publish > finalize);
  const finalizerStep = workflow.slice(finalize, publish);
  assert.match(finalizerStep, /continue-on-error: true/);
  assert.match(finalizerStep, /merged_count != '0'/);
  assert.match(finalizerStep, /integration-deep-repair-finalize\.mjs \.deploy-state\/integration\.json/);
});
