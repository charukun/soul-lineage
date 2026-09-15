import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  automaticPublisherTitle, isAutomaticPublisher, publicationWakeContext, requestDevelopPublication,
} from '../scripts/integration-publication.mjs';

const sha = 'b'.repeat(40);
const oldSha = 'a'.repeat(40);
const report = { mode: 'FAST_LANE', sha: oldSha, merged: [{ pr: 277 }, { pr: 281 }] };
const idle = { ...report, merged: [] };
const initialWakeDescription = 'DEV/PULSE publication requested; public verification pending';
const recoveryWakeDescription = 'DEV/PULSE publication recovery requested; public verification pending';
const run = (id, fields = {}) => ({
  id, head_sha: sha, head_branch: 'develop', event: 'workflow_dispatch',
  display_title: automaticPublisherTitle, status: 'in_progress', conclusion: null, ...fields,
});

function fixture({ runs = [], statuses = [], dispatchError, cancelError } = {}) {
  const calls = [];
  const c = {
    root: '/repos/charukun/soul-lineage',
    async api(method, path, body) {
      calls.push({ method, path, body });
      if (method === 'GET' && path.endsWith('/branches/develop')) return { commit: { sha } };
      if (path.endsWith('/dispatches') && dispatchError) throw new Error(dispatchError);
      if (path.endsWith('/cancel') && cancelError) throw new Error(cancelError);
      if (method === 'POST') return null;
      throw new Error(`Unexpected API ${method} ${path}`);
    },
    async pages(path) {
      calls.push({ method: 'PAGES', path });
      if (path === `/commits/${sha}/statuses`) return statuses;
      if (path === '/actions/workflows/deploy.yml/runs?branch=develop') return runs;
      if (path === '/actions/workflows/deploy.yml/runs?branch=develop&status=completed') {
        return runs.filter(item => item.status === 'completed');
      }
      throw new Error(`Unexpected pages ${path}`);
    },
  };
  return { c, calls, writes: () => calls.filter(item => item.method === 'POST') };
}

test('a merged batch explicitly requests one existing DEV/PULSE publisher using current develop', async () => {
  const f = fixture();
  const result = await requestDevelopPublication(f.c, report);
  assert.deepEqual(result, { state: 'requested', sha, cancelled: [] });
  const dispatches = f.writes().filter(item => item.path.endsWith('/dispatches'));
  assert.deepEqual(dispatches, [{ method: 'POST',
    path: `${f.c.root}/actions/workflows/deploy.yml/dispatches`,
    body: { ref: 'develop', inputs: { publish_only: 'true', automatic_publish: 'true' } },
  }]);
  const recorded = f.writes().filter(item => item.path.includes('/statuses/'));
  assert.deepEqual(recorded.map(item => item.body.state), ['pending', 'success']);
  assert.ok(recorded.every(item => item.body.context === publicationWakeContext));
  assert.match(recorded.at(-1).body.description, /public verification pending/);
  assert.equal(f.calls.filter(item => item.method === 'PAGES' && item.path.startsWith('/actions/workflows/deploy.yml/runs')).length, 1);
});

test('an idle pass bootstraps the unpublished SHA left by the previous Controller', async () => {
  const f = fixture();
  assert.equal((await requestDevelopPublication(f.c, idle)).state, 'requested');
  assert.equal(f.writes().filter(item => item.path.endsWith('/dispatches')).length, 1);
});

test('an orphaned accepted wake receipt gets one bounded recovery dispatch', async () => {
  for (const state of ['pending', 'success']) {
    const f = fixture({ statuses: [{ context: publicationWakeContext, state, description: initialWakeDescription }] });
    assert.equal((await requestDevelopPublication(f.c, idle)).state, 'requested');
    assert.equal(f.writes().filter(item => item.path.endsWith('/dispatches')).length, 1);
    assert.equal(f.writes().filter(item => item.path.includes('/statuses/')).at(-1).body.description, recoveryWakeDescription);
  }
});

test('a failed wake receipt stays repair-owned instead of retrying forever', async () => {
  const f = fixture({ statuses: [{ context: publicationWakeContext, state: 'failure' }] });
  assert.equal((await requestDevelopPublication(f.c, idle)).state, 'already-requested-or-published');
  assert.deepEqual(f.writes(), []);
});

test('an already verified public source does not redispatch', async () => {
  const f = fixture({ statuses: [
    { context: 'integration/develop', state: 'success' },
    { context: 'ops-board/public', state: 'success' },
  ] });
  assert.equal((await requestDevelopPublication(f.c, idle)).state, 'already-requested-or-published');
  assert.deepEqual(f.writes(), []);
});

test('a completed exact-source publisher proves the wake was consumed from the shared snapshot', async () => {
  for (const conclusion of ['success', 'failure']) {
    const f = fixture({
      statuses: [{ context: publicationWakeContext, state: 'success', description: initialWakeDescription }],
      runs: [run(7, { status: 'completed', conclusion })],
    });
    assert.equal((await requestDevelopPublication(f.c, idle)).state, 'already-requested-or-published');
    assert.deepEqual(f.writes(), []);
    assert.equal(f.calls.filter(item => item.method === 'PAGES' && item.path.startsWith('/actions/workflows/deploy.yml/runs')).length, 1);
  }
});

test('a cancelled exact-source publisher can be recovered once', async () => {
  const f = fixture({
    statuses: [{ context: publicationWakeContext, state: 'success', description: initialWakeDescription }],
    runs: [run(7, { status: 'completed', conclusion: 'cancelled' })],
  });
  assert.equal((await requestDevelopPublication(f.c, idle)).state, 'requested');
  assert.equal(f.writes().filter(item => item.path.endsWith('/dispatches')).length, 1);
  assert.equal(f.writes().filter(item => item.path.includes('/statuses/')).at(-1).body.description, recoveryWakeDescription);
});

test('a saturated first workflow page may spend one completed fallback lookup', async () => {
  const filler = Array.from({ length: 100 }, (_, i) => run(i + 1, { head_sha: oldSha, status: 'completed', conclusion: 'cancelled' }));
  const f = fixture({
    statuses: [{ context: publicationWakeContext, state: 'success', description: initialWakeDescription }],
    runs: filler,
  });
  assert.equal((await requestDevelopPublication(f.c, idle)).state, 'requested');
  assert.equal(f.calls.filter(item => item.method === 'PAGES' && item.path.startsWith('/actions/workflows/deploy.yml/runs')).length, 2);
});

test('a second orphan after the bounded recovery does not create an unbounded dispatch loop', async () => {
  const f = fixture({ statuses: [{
    context: publicationWakeContext, state: 'success', description: recoveryWakeDescription,
  }] });
  assert.equal((await requestDevelopPublication(f.c, idle)).state, 'already-requested-or-published');
  assert.deepEqual(f.writes(), []);
});

test('an active same-source publisher absorbs duplicate requests while superseded publishers coalesce', async () => {
  const f = fixture({ runs: [run(1, { head_sha: oldSha }), run(2), run(3, { event: 'push', head_sha: oldSha, status: 'queued' })] });
  assert.deepEqual(await requestDevelopPublication(f.c, report), { state: 'already-active', sha, run: 2, cancelled: [1, 3] });
  assert.equal(f.writes().filter(item => item.path.endsWith('/cancel')).length, 2);
  assert.equal(f.writes().filter(item => item.path.endsWith('/dispatches')).length, 0);
});

test('manual publication, Integration, repair, Production and completed runs are never cancelled', async () => {
  const protectedRuns = [
    run(1, { display_title: 'Deploy DEV and PROD', head_sha: oldSha }),
    run(2, { display_title: 'Integration Controller', head_sha: oldSha }),
    run(3, { display_title: 'Repair executor pool', head_sha: oldSha }),
    run(4, { head_branch: 'main', event: 'push', head_sha: oldSha }),
    run(5, { event: 'pull_request', head_sha: oldSha }),
    run(6, { status: 'completed', head_sha: oldSha, conclusion: 'success' }),
  ];
  const f = fixture({ runs: protectedRuns });
  await requestDevelopPublication(f.c, report);
  assert.equal(f.writes().filter(item => item.path.endsWith('/cancel')).length, 0);
  assert.equal(f.writes().filter(item => item.path.endsWith('/dispatches')).length, 1);
  assert.equal(isAutomaticPublisher(protectedRuns[3]), false);
});

test('dispatch failure is observable without claiming public success', async () => {
  const f = fixture({ dispatchError: 'GitHub dispatch: HTTP 403' });
  await assert.rejects(requestDevelopPublication(f.c, report), /HTTP 403/);
  assert.equal(f.writes().at(-1).body.context, publicationWakeContext);
  assert.equal(f.writes().at(-1).body.state, 'failure');
  assert.ok(f.writes().every(item => !['integration/develop', 'ops-board/public'].includes(item.body?.context)));
});

test('a cancellation race is harmless but an authorization failure fails the request', async () => {
  for (const code of [409, 422]) {
    const f = fixture({ runs: [run(1, { head_sha: oldSha })], cancelError: `GitHub cancel: HTTP ${code}` });
    assert.equal((await requestDevelopPublication(f.c, report)).state, 'requested');
  }
  const f = fixture({ runs: [run(1, { head_sha: oldSha })], cancelError: 'GitHub cancel: HTTP 403' });
  await assert.rejects(requestDevelopPublication(f.c, report), /HTTP 403/);
  assert.equal(f.writes().at(-1).body.state, 'failure');
});

test('workflow connects the bot merge to a permitted asynchronous publication wake and both publishers', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const integrate = controller.split('  integrate:')[1].split('\n  repair:')[0];
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.match(integrate, /actions: write/);
  assert.match(integrate, /steps\.fast-lane\.outcome == 'success'/);
  assert.match(integrate, /node scripts\/integration-publication\.mjs \.deploy-state\/integration\.json/);
  assert.doesNotMatch(integrate, /needs:.*(?:publish|pulse)|gh run watch/);
  assert.match(deploy, /run-name:.*inputs\.publish_only == true && inputs\.automatic_publish == true/);
  assert.ok(deploy.includes(automaticPublisherTitle));
  for (const job of ['pulse', 'publish']) {
    const source = deploy.split(`  ${job}:`)[1].split(/\n  [a-z][\w-]*:/)[0];
    assert.match(source, /inputs\.publish_only == true/);
  }
  assert.match(deploy, /Preserve blocking Production browser verification/);
});
