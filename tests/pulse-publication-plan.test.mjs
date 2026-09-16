import test from 'node:test';
import assert from 'node:assert/strict';
import { pulsePublicationPath, pulseDeployRequired, pulseChangedPaths } from '../ops-board/publication-plan.mjs';

const sha = c => c.repeat(40);

test('PULSE deploy paths mirror the runtime publication surface', () => {
  for (const path of [
    'ops-board/worker.mjs',
    'ops-board/public/app.js',
    'scripts/application-catalog.mjs',
    'scripts/integration-rescue-policy.mjs',
    'wrangler.rescue-watchdog.jsonc',
    'wrangler.ops.jsonc',
    '.github/workflows/ops-board.yml',
    'apps/rinne/package.json',
    'tests/pulse-api-budget-contract.test.mjs',
    'tests/ops-board.test.mjs',
  ]) assert.equal(pulsePublicationPath(path), true, path);
  for (const path of ['apps/rinne/src/rebuild/runtime.js', '.github/workflows/ci.yml', 'docs/OPS_BOARD.md']) {
    assert.equal(pulsePublicationPath(path), false, path);
  }
});

test('ordinary game changes refresh state without redeploying the PULSE runtime', () => {
  assert.equal(pulseDeployRequired(['apps/rinne/src/rebuild/runtime.js', 'packages/network/src/index.js']), false);
  assert.equal(pulseDeployRequired(['apps/rinne/src/rebuild/runtime.js', 'ops-board/worker.mjs']), true);
});

test('changed paths use one local git diff and reject invalid identities', () => {
  const calls = [];
  const run = (...args) => { calls.push(args); return 'apps/rinne/src/a.js\nops-board/public/app.js\n'; };
  assert.deepEqual(pulseChangedPaths(sha('a'), sha('b'), run), ['apps/rinne/src/a.js', 'ops-board/public/app.js']);
  assert.equal(calls.length, 1);
  assert.throws(() => pulseChangedPaths('develop', sha('b'), run), /SHA_REQUIRED/);
});
