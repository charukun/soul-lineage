import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const fastDevWorkflow = readFileSync('.github/workflows/dev-app-publish.yml', 'utf8');

test('DEV result job may write the PR comment that drives developer email', () => {
  const resultBlock = workflow.match(/\n  result:\n[\s\S]*?\n  canary:/)?.[0] || '';
  assert.match(resultBlock, /\n    permissions:\n[\s\S]*?\n      issues: write\n      pull-requests: write\n/);
  assert.doesNotMatch(resultBlock, /\n      pull-requests: read\n/);
  assert.match(resultBlock, /Create verified DEV email receipts/);
  assert.match(resultBlock, /steps\.notify\.outputs\.dev_email/);
  assert.match(resultBlock, /notification\/dev-email/);
  assert.doesNotMatch(resultBlock, /NTFY_TOPIC_URL|NTFY_TOKEN|notification\/ntfy|ntfy smartphone/);
});


test('fast DEV notification job may write the PR comment that drives developer email', () => {
  const notifyBlock = fastDevWorkflow.match(/\n  notify:\n[\s\S]*?\n  pulse:/)?.[0] || '';
  assert.match(notifyBlock, /\n    permissions:\n[\s\S]*?\n      issues: write\n      pull-requests: write\n/);
  assert.doesNotMatch(notifyBlock, /\n      pull-requests: read\n/);
  assert.match(notifyBlock, /Create one DEV completion receipt after all affected apps are live/);
  assert.match(notifyBlock, /notify-fast-dev\.mjs/);
});
