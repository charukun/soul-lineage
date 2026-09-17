import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAiRepairEnvelope } from '../scripts/integration-ai-repair-envelope.mjs';
import {
  chatRepairBundle,
  chatRepairIssueMarker,
  deepRepairIssueMarker,
  deepRepairIssueState,
  deepRepairSafety,
  normalChatRepairPrompt,
  parseChatRepairIssueMarker,
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

test('chat repair marker pins recovery coordinates while requiring a manually started normal Chat', () => {
  const bundle = chatRepairBundle({ repository, pr, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  const body = chatRepairIssueMarker(bundle);
  const parsed = parseChatRepairIssueMarker(body);
  assert.equal(parsed.sourceKey, `pr:236:head:${head}`);
  assert.equal(parsed.execution, 'normal-chat-manual-start');
  assert.deepEqual(parsed.prohibited, ['chatgpt-work', 'codex', 'openai-api', 'paid-model-api']);
  const prompt = normalChatRepairPrompt({ repository, state: deepRepairIssueState({ pr, develop, reason: 'MERGE_CONFLICT' }), pr });
  assert.match(prompt, /Work \/ Codex \/ OpenAI API \/追加の有料APIは使わない/);
  assert.match(prompt, /source PR側の意図とcurrent develop側の意図/);
  assert.match(prompt, /無条件ours\/theirs/);
  assert.match(prompt, /READY_FOR_INTEGRATION/);
});

test('deep repair never bypasses dependency, hold, requested changes or unresolved threads', () => {
  assert.equal(deepRepairSafety({ ...safe, dependenciesMerged: false }), 'dependency PR is not merged into develop');
  assert.equal(deepRepairSafety({ ...safe, unresolved: true }), 'unresolved review or requested changes');
  assert.equal(deepRepairSafety({ ...safe, pr: { ...pr, labels: [{ name: 'integration:hold' }] } }), 'explicit Integration hold');
  assert.equal(deepRepairSafety({ ...safe, reviews: [{ id: 1, state: 'CHANGES_REQUESTED', user: { login: 'reviewer' } }] }), 'unresolved review or requested changes');
});

test('signalDeepRepair creates one owner-notified normal-Chat issue per exact head and records pending status', async () => {
  const calls = [];
  const c = {
    root: '/repos/charukun/soul-lineage',
    async pages(path) {
      assert.match(path, /\/statuses$/);
      return [];
    },
    async api(method, path, body) {
      if (method === 'GET' && path.startsWith('/search/issues?')) return { items: [], total_count: 0, incomplete_results: false };
      if (method === 'GET' && path.includes('/issues?state=open')) return [];
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
  assert.match(issue.body.title, /^\[RINNE 要Chat修復\] PR #236/);
  assert.deepEqual(issue.body.assignees, ['charukun']);
  assert.match(issue.body.body, /integration-deep-repair:v1/);
  assert.match(issue.body.body, /rinne-ai-repair:v1/);
  assert.match(issue.body.body, /chat-repair:v1/);
  assert.match(issue.body.body, /CHAT_REPAIR_REQUIRED/);
  assert.match(issue.body.body, /@charukun/);
  assert.match(issue.body.body, /GitHub通知メールの配送有無はownerのGitHub通知設定に従います/);
  assert.doesNotMatch(issue.body.body, /ChatGPT Work must/);
  const chat = parseChatRepairIssueMarker(issue.body.body);
  assert.equal(chat.execution, 'normal-chat-manual-start');
  assert.equal(chat.sourceKey, `pr:236:head:${head}`);
  const envelope = parseAiRepairEnvelope(issue.body.body);
  assert.equal(envelope.attempt, 0);
  assert.equal(envelope.maxAttempts, 2);
  assert.equal(envelope.head, head);
  assert.match(envelope.constraints.join('\n'), /DEV publication -> user visual feedback -> AI correction/);
  assert.match(envelope.constraints.join('\n'), /Adapt stale PR behavior to current confirmed specifications/);
  assert.match(envelope.constraints.join('\n'), /Never automatically clear an existing human-required decision/);
  assert.match(envelope.constraints.join('\n'), /preserve exact-head, review, thread, check, browser and Production gates/);
  const status = calls.find(call => call.path.endsWith(`/statuses/${head}`));
  assert.equal(status.body.context, 'integration/deep-repair');
  assert.equal(status.body.state, 'pending');
  assert.match(status.body.description, /normal Chat repair/);
});

test('signalDeepRepair reuses an existing exact-head Chat issue instead of duplicating or re-notifying it', async () => {
  const state = deepRepairIssueState({ pr, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  const bundle = chatRepairBundle({ repository, pr, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  const existing = {
    number: 501,
    state: 'open',
    html_url: 'https://github.com/charukun/soul-lineage/issues/501',
    body: `${deepRepairIssueMarker(state)}\n${chatRepairIssueMarker(bundle)}`,
  };
  let created = 0;
  let patched = 0;
  const c = {
    root: '/repos/charukun/soul-lineage',
    async pages() { return []; },
    async api(method, path) {
      if (method === 'GET' && path.startsWith('/search/issues?')) return { items: [existing], total_count: 1, incomplete_results: false };
      if (method === 'GET' && path.includes('/issues?state=open')) return [existing];
      if (method === 'GET' && path.endsWith('/issues/501')) return existing;
      if (method === 'POST' && path === '/repos/charukun/soul-lineage/issues') created++;
      if (method === 'PATCH' && path.endsWith('/issues/501')) patched++;
      if (path.endsWith(`/statuses/${head}`)) return {};
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const result = await signalDeepRepair(c, { ...safe, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  assert.equal(result.issue, 501);
  assert.equal(created, 0);
  assert.equal(patched, 0);
});

test('signalDeepRepair migrates a legacy Work issue to one owner-notified Chat handoff', async () => {
  const state = deepRepairIssueState({ pr, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  let existing = {
    number: 501,
    state: 'open',
    html_url: 'https://github.com/charukun/soul-lineage/issues/501',
    body: `${deepRepairIssueMarker(state)}\nlegacy Work instructions`,
  };
  const patches = [];
  const c = {
    root: '/repos/charukun/soul-lineage',
    async pages() { return []; },
    async api(method, path, body) {
      if (method === 'GET' && path.startsWith('/search/issues?')) return { items: [existing], total_count: 1, incomplete_results: false };
      if (method === 'GET' && path.includes('/issues?state=open')) return [existing];
      if (method === 'GET' && path.endsWith('/issues/501')) return existing;
      if (method === 'PATCH' && path.endsWith('/issues/501')) {
        patches.push(body);
        existing = { ...existing, ...body };
        return existing;
      }
      if (path.endsWith(`/statuses/${head}`)) return {};
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  const result = await signalDeepRepair(c, { ...safe, develop, reason: 'MERGE_CONFLICT', repairKind: 'semantic' });
  assert.equal(result.issue, 501);
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].assignees, ['charukun']);
  assert.match(patches[0].body, /WORK_REPAIR_RETIRED/);
  assert.match(patches[0].body, /chat-repair:v1/);
  assert.match(patches[0].body, /CHAT_REPAIR_REQUIRED/);
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
