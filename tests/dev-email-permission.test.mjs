import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

test('DEV result job may write the PR comment that drives developer email', () => {
  const resultBlock = workflow.match(/\n  result:\n[\s\S]*?\n  canary:/)?.[0] || '';
  assert.match(resultBlock, /\n    permissions:\n[\s\S]*?\n      issues: write\n      pull-requests: write\n/);
  assert.doesNotMatch(resultBlock, /\n      pull-requests: read\n/);
  assert.match(resultBlock, /Create verified DEV email receipts/);
  assert.match(resultBlock, /steps\.notify\.outputs\.dev_email/);
  assert.match(resultBlock, /notification\/dev-email/);
  assert.doesNotMatch(resultBlock, /NTFY_TOPIC_URL|NTFY_TOKEN|notification\/ntfy|ntfy smartphone/);
});
