import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deepRepairIssueMarker,
  deepRepairIssueState,
  deepRepairSafety,
  parseDeepRepairIssue,
  signalDeepRepair,
} from '../scripts/integration-deep-repair-handoff.mjs';

const repository = 'charukun/soul-lineage';
const head = 'a'.repeat(40);
const develop = 'b'.repeat(40);
const pr = {
  number: 236,
  state: 'open',
  draft: false,
  body: 'Depends-On: #229',
  html_url: 'https://github.com/charukun/soul-lineage/pull/236',
  author_association: 'OWNER',
  labels: [],
  base: { ref: 'develop', repo: { full_name: repository } },
  head: { ref: 'feat/world-simulation-scale', sha: head, repo: { full_name: repository } },
};

const safe = { pr, repository, dependenciesMerged: true, unresolved: false, reviews: [] };

test('deep repair issue marker round-trips exact PR/head/develop state', () => {
  const state = deepRepairIssueState({ pr, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  assert.equal(state.state, 'pending');
  assert.equal(state.attempt, 0);
  assert.equal(state.maxAttempts, 2);
  assert.equal(state.sourceKey, `pr:236:head:${head}`);
  assert.deepEqual(parseDeepRepairIssue(deepRepairIssueMarker(state)), state);
});

test('deep repair never bypasses dependency, hold, requested changes or unresolved threads', () => {
  assert.equal(deepRepairSafety({ ...safe, dependenciesMerged: false }), 'dependency PR is not merged into develop');
  assert.equal(deepRepairSafety({ ...safe, unresolved: true }), 'unresolved review or requested changes');
  assert.equal(deepRepairSafety({ ...safe, pr: { ...pr, labels: [{ name: 'integration:hold' }] } }), 'explicit Integration hold');
  assert.equal(deepRepairSafety({ ...safe, reviews: [{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'reviewer' } }] }), 'unresolved review or requested changes');
});

test('signalDeepRepair creates one issue per exact head and records pending status', async () => {
  const calls = [];
  const c = {
    root: '/repos/charukun/soul-lineage',
    async pages(path) {
      assert.match(path, /^\/issues\?/);
      return [];
    },
    async api(method, path, body) {
      calls.push({ method, path, body });
      if (method === 'POST' && path === '/repos/charukun/soul-lineage/issues') {
        return { number: 501, html_url: 'https://github.com/charukun/soul-lineage/issues/501', body: body.body };
      }
      if (method === 'POST' && path === `/repos/charukun/soul-lineage/statuses/${head}`) return {};
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const result = await signalDeepRepair(c, {
    ...safe,
    develop,
    reason: 'MERGE_CONFLICT: dirty',
    repairKind: 'semantic',
  });
  assert.equal(result.signaled, true);
  assert.equal(result.issue, 501);
  const issue = calls.find(call => call.path === '/repos/charukun/soul-lineage/issues');
  assert.match(issue.body.body, /integration-deep-repair:v1/);
  assert.match(issue.body.body, /rinne-ai-repair:v1/);
  assert.match(issue.body.body, /AI_DEEP_REPAIR_REQUIRED/);
  const status = calls.find(call => call.path.endsWith(`/statuses/${head}`));
  assert.equal(status.body.context, 'integration/deep-repair');
  assert.equal(status.body.state, 'pending');
});

test('signalDeepRepair reuses an existing exact-head issue instead of duplicating it', async () => {
  const state = deepRepairIssueState({ pr, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  const existing = { number: 501, html_url: 'https://github.com/charukun/soul-lineage/issues/501', body: deepRepairIssueMarker(state) };
  let created = 0;
  const c = {
    root: '/repos/charukun/soul-lineage',
    async pages() { return [existing]; },
    async api(method, path) {
      if (path === '/repos/charukun/soul-lineage/issues') created++;
      if (path.endsWith(`/statuses/${head}`)) return {};
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const result = await signalDeepRepair(c, { ...safe, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  assert.equal(result.issue, 501);
  assert.equal(created, 0);
});

test('Fast Lane signals true conflicts immediately while browser and DEV remain nonblocking', () => {
  const fastLane = readFileSync('scripts/integration-fast-lane.mjs', 'utf8');
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const publication = readFileSync('scripts/integration-publication.mjs', 'utf8');
  assert.match(fastLane, /pr\.mergeable === false && pr\.mergeable_state === 'dirty'/);
  assert.match(fastLane, /signalDeepRepair/);
  assert.match(controller, /issues: write/);
  assert.match(controller, /Merge every independently eligible exact head without waiting for DEV\/browser/);
  assert.match(publication, /active\.filter\(item => item\.head_sha !== sha\)/);
});
