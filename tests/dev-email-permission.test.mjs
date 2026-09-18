import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

test('DEV result job may write the PR comment that drives developer email', () => {
  const resultBlock = workflow.match(/\n  result:\n[\s\S]*?\n  canary:/)?.[0] || '';
  assert.match(resultBlock, /\n    permissions:\n[\s\S]*?\n      issues: write\n      pull-requests: write\n      statuses: write\n      actions: write\n/);
  assert.doesNotMatch(resultBlock, /\n      pull-requests: read\n/);
  assert.match(resultBlock, /Notify verified DEV delivery/);
});


test('DEV email lookup may read LKG artifacts without adding a separate notification queue', () => {
  assert.match(workflow, /Notify verified DEV delivery/);
  assert.match(resultBlock, /actions: write/);
  assert.doesNotMatch(workflow, /smtp|sendgrid|mailgun/i);
});
