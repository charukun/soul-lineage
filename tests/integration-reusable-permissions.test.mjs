import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Develop Merge Gate grants merge lane and optional Repair only their required permissions', () => {
  const controller = readFileSync('.github/workflows/develop-merge.yml', 'utf8');
  const repair = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  const fastLane = controller.match(/\n  merge:\n[\s\S]*?\n  repair:/)?.[0] || '';
  const caller = controller.match(/\n  repair:\n[\s\S]*$/)?.[0] || '';
  const repairJob = repair.match(/\n  repair:\n[\s\S]*?\n  stack-fast:/)?.[0] || '';

  assert.match(fastLane, /permissions:[\s\S]*?contents: write/);
  assert.match(fastLane, /permissions:[\s\S]*?pull-requests: write/);
  assert.match(fastLane, /permissions:[\s\S]*?checks: read/);
  assert.match(fastLane, /permissions:[\s\S]*?statuses: write/);
  assert.doesNotMatch(fastLane, /pages: write/);

  assert.match(caller, /permissions:[\s\S]*?contents: write/);
  assert.match(caller, /permissions:[\s\S]*?pull-requests: read/);
  assert.match(caller, /permissions:[\s\S]*?actions: write/);
  assert.match(caller, /permissions:[\s\S]*?statuses: write/);
  assert.doesNotMatch(caller, /issues: write/);
  assert.doesNotMatch(caller, /checks: read/);

  assert.match(repairJob, /permissions:[\s\S]*?contents: write/);
  assert.match(repairJob, /permissions:[\s\S]*?pull-requests: read/);
  assert.doesNotMatch(repairJob, /statuses: write/);
  assert.doesNotMatch(controller, /\n  virtual-train:/);
});
