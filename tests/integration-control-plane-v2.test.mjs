import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Integration Controller owns merge evaluation while deploy owns publication', () => {
  const controller = read('.github/workflows/integration-controller.yml');
  const deploy = read('.github/workflows/deploy.yml');
  assert.match(controller, /name: Integration Controller/);
  assert.match(controller, /node scripts\/integration-controller\.mjs/);
  assert.match(controller, /Parallel Integration Rescue/);
  assert.doesNotMatch(controller, /actions\/deploy-pages/);
  assert.match(deploy, /name: Publish application snapshot/);
  assert.match(deploy, /actions\/deploy-pages@v4/);
  assert.match(deploy, /node sources\/dev\/scripts\/site-dedupe\.mjs _site/);
  assert.doesNotMatch(deploy, /node scripts\/integration(?:-controller)?\.mjs/);
});

test('DEV success wakes recovery through Integration Controller and runs canary', () => {
  const deploy = read('.github/workflows/deploy.yml');
  const recovery = read('scripts/integration-queue-recovery.mjs');
  assert.match(deploy, /workflow_id: 'integration-controller\.yml'/);
  assert.match(deploy, /node scripts\/integration-control-canary\.mjs/);
  assert.match(recovery, /actions\/workflows\/integration-controller\.yml\/dispatches/);
  assert.doesNotMatch(recovery, /actions\/workflows\/deploy\.yml\/dispatches/);
});

test('legacy deploy dispatch is a bounded compatibility router, not an Integration implementation', () => {
  const deploy = read('.github/workflows/deploy.yml');
  assert.match(deploy, /Route legacy Integration wakeup/);
  assert.match(deploy, /coalesced behind run/);
  assert.match(deploy, /integration\/wakeup/);
});
