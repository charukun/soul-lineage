import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('bounded Integration scan carries its cursor without serializing Pages', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.match(workflow, /integration_cursor:/);
  assert.match(workflow, /INTEGRATION_EVALUATION_CURSOR: \$\{\{ inputs\.integration_cursor \|\| '0' \}\}/);
  assert.match(workflow, /cursor: \$\{\{ steps\.queue\.outputs\.cursor \}\}/);
  assert.match(workflow, /integration-continuation:[\s\S]*needs\.integrate\.outputs\.verify == 'false'/);
  assert.match(workflow, /integration-continuation:[\s\S]*inputs: \{ integration_cursor: process\.env\.CURSOR \|\| '0' \}/);
  assert.match(workflow, /result:[\s\S]*CURSOR: \$\{\{ needs\.integrate\.outputs\.cursor \}\}/);
  assert.doesNotMatch(workflow, /^concurrency:\n\s+group: pages/m);
  assert.match(workflow, /integrate:[\s\S]*group: integration-develop/);
  assert.match(workflow, /publish:[\s\S]*group: pages/);
});