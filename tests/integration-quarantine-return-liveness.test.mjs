import test from 'node:test';
import assert from 'node:assert/strict';
import { quarantineDecision, returnedRepairHead } from '../scripts/integration-flow-control.mjs';
import { signalQuarantine } from '../scripts/integration-quarantine-signal.mjs';

const repository = 'charukun/soul-lineage';
const head = 'b'.repeat(40);
const failures = [
  { reason: 'VALIDATION_FAILED:unit' },
  { reason: 'Affected browser smoke failure' },
  { reason: 'GitHub POST /git/trees: HTTP 422' },
  { reason: 'FAST_NOT_PASSED' },
];

function returnedRecord() {
  return {
    pr: 252,
    branch: 'fix/pulse-information-hierarchy',
    state: 'CHECKING',
    headSha: head,
    pushedSha: head,
    failures,
    workRepair: { status: 'returned', result: { head } },
  };
}

test('historical failures do not re-quarantine the exact head returned by Work repair', () => {
  const record = returnedRecord();
  assert.equal(returnedRepairHead(record), true);
  assert.deepEqual(quarantineDecision(record), { quarantined: false, failures: 4, reason: null, released: true });

  const unresolved = { ...record, state: 'FAILED_MANUAL', workRepair: { status: 'failed', result: { head } } };
  assert.equal(returnedRepairHead(unresolved), false);
  assert.equal(quarantineDecision(unresolved).quarantined, true);
});

test('trusted quarantine signal clears stale pending status and immediately re-wakes Integration', async () => {
  const record = returnedRecord();
  const posts = [];
  const c = {
    root: `/repos/${repository}`,
    async api(method, path, body) {
      if (method === 'GET' && path.endsWith('/branches/develop')) return { commit: { sha: 'd'.repeat(40) } };
      if (method === 'GET' && path.endsWith('/pulls/252')) return {
        number: 252,
        state: 'open',
        draft: false,
        html_url: 'https://github.com/charukun/soul-lineage/pull/252',
        head: { sha: head, ref: record.branch, repo: { full_name: repository } },
        base: { ref: 'develop' },
      };
      if (method === 'POST') { posts.push({ path, body }); return {}; }
      throw new Error(`${method} ${path}`);
    },
    async pages(path) {
      if (path.endsWith(`/commits/${head}/statuses`)) return [{ context: 'integration/quarantine', state: 'pending' }];
      throw new Error(path);
    },
  };
  const store = { read: async () => ({ state: { records: { 252: record } } }) };

  assert.deepEqual(await signalQuarantine(c, store), []);
  assert.deepEqual(posts, [
    {
      path: `/repos/${repository}/statuses/${head}`,
      body: {
        state: 'success',
        context: 'integration/quarantine',
        description: 'Returned AI repair is on this exact head; normal Integration re-evaluation resumed',
        target_url: 'https://github.com/charukun/soul-lineage/pull/252',
      },
    },
    { path: `/repos/${repository}/actions/workflows/deploy.yml/dispatches`, body: { ref: 'develop' } },
  ]);
});
