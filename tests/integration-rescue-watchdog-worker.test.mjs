import test from 'node:test';
import assert from 'node:assert/strict';
import { isReadyDevelopPull, wakeRescue } from '../scripts/integration-rescue-watchdog-worker.mjs';

const env = { RESCUE_GITHUB_TOKEN: 'token' };
const pr = fields => ({ state: 'open', draft: false, base: { ref: 'develop' }, ...fields });

function response(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('watchdog only treats open non-draft develop PRs as recovery work', () => {
  assert.equal(isReadyDevelopPull(pr()), true);
  assert.equal(isReadyDevelopPull(pr({ draft: true })), false);
  assert.equal(isReadyDevelopPull(pr({ state: 'closed' })), false);
  assert.equal(isReadyDevelopPull(pr({ base: { ref: 'main' } })), false);
});

test('idle watchdog spends one read and does not dispatch Actions', async () => {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url, options });
    return response([]);
  };
  assert.deepEqual(await wakeRescue(env, request), { dispatched: false, ready: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, undefined);
  assert.match(calls[0].url, /\/pulls\?state=open&base=develop/);
});

test('watchdog dispatches one bounded repair scan only when Ready work exists', async () => {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('/pulls?')) return response([pr({ number: 7 }), pr({ number: 8, draft: true })]);
    if (url.endsWith('/actions/workflows/deploy.yml/dispatches')) return response(null, 204);
    throw new Error(`unexpected request ${url}`);
  };
  assert.deepEqual(await wakeRescue(env, request), { dispatched: true, ready: 1 });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { ref: 'develop', inputs: { rescue_mode: 'scan' } });
});

test('watchdog fails closed when its ready scan is unavailable', async () => {
  await assert.rejects(wakeRescue(env, async () => response({ message: 'rate limited' }, 429)), /ready scan: HTTP 429/);
});
