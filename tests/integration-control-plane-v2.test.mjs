import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('reusable Integration Controller owns merge evaluation while deploy owns publication', () => {
  const controller = read('.github/workflows/integration-controller.yml');
  const deploy = read('.github/workflows/deploy.yml');
  assert.match(controller, /name: Integration Controller/);
  assert.match(controller, /workflow_call:/);
  assert.match(controller, /node scripts\/integration-controller\.mjs/);
  assert.match(controller, /Parallel Integration Rescue/);
  assert.doesNotMatch(controller, /actions\/deploy-pages/);
  assert.match(deploy, /uses: \.\/\.github\/workflows\/integration-controller\.yml/);
  assert.match(deploy, /name: Publish application snapshot/);
  assert.match(deploy, /actions\/deploy-pages@v4/);
  assert.match(deploy, /node sources\/dev\/scripts\/site-dedupe\.mjs _site/);
  assert.doesNotMatch(deploy, /node scripts\/integration(?:-controller)?\.mjs/);
});

test('DEV success wakes the registered gateway and runs canary', () => {
  const deploy = read('.github/workflows/deploy.yml');
  const recovery = read('scripts/integration-queue-recovery.mjs');
  assert.match(deploy, /workflow_id: 'deploy\.yml'.*rescue_mode: 'scan'/s);
  assert.match(deploy, /node scripts\/integration-control-canary\.mjs/);
  assert.match(recovery, /actions\/workflows\/deploy\.yml\/dispatches/);
  assert.doesNotMatch(recovery, /actions\/workflows\/integration-controller\.yml\/dispatches/);
});

test('registered deploy gateway coalesces wakeups before admitting controller work', () => {
  const deploy = read('.github/workflows/deploy.yml');
  assert.match(deploy, /Coalesce Integration wakeup/);
  assert.match(deploy, /coalesced behind run/);
  assert.match(deploy, /integration\/wakeup/);
  assert.match(deploy, /run_control/);
});
