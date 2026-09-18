import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('DEV publisher supports explicit bot wakes while ordinary push runs still coalesce', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const coalescer = readFileSync('.github/workflows/dev-publisher-coalescer.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');

  assert.doesNotMatch(controller, /publisher-handoff:/,
    'Fast Lane must not wait for a publisher job');
  assert.match(controller, /node scripts\/integration-publication\.mjs/,
    'GITHUB_TOKEN merges need an explicit wake instead of relying on push recursion');
  assert.match(deploy, /push:\n\s+branches: \[develop, main\]/,
    'develop push itself owns DEV publication');
  assert.match(coalescer, /getBranch\(\{ \.\.\.context\.repo, branch: 'develop' \}\)/);
  assert.match(coalescer, /run\.status === 'in_progress'/,
    'an already-running publisher is explicitly preserved instead of restarted');
  assert.match(coalescer, /const cancel = queued\.filter\(run => run !== keepQueued\)/,
    'only redundant queued publishers are cancelled');
  assert.match(coalescer, /cancelWorkflowRun/);
  assert.match(coalescer, /inputs\.automatic_publish|DEV Publisher \(automatic\)|workflow_dispatch/,
    'only explicitly automatic workflow_dispatch publishers participate in coalescing');
});
