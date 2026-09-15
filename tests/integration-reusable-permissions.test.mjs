import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Integration Controller grants Fast Lane and optional repair only their required permissions', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const rescue = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  const fastLane = controller.match(/\n  integrate:\n[\s\S]*?\n  repair:/)?.[0] || '';
  const caller = controller.match(/\n  repair:\n[\s\S]*$/)?.[0] || '';
  const worker = rescue.match(/\n  worker:\n[\s\S]*?\n  return:/)?.[0] || '';

  assert.match(fastLane, /permissions:[\s\S]*?contents: write/);
  assert.match(fastLane, /permissions:[\s\S]*?pull-requests: write/);
  assert.match(fastLane, /permissions:[\s\S]*?checks: read/);
  assert.match(fastLane, /permissions:[\s\S]*?statuses: write/);
  assert.doesNotMatch(fastLane, /pages: write/);

  assert.match(caller, /permissions:[\s\S]*?contents: write/);
  assert.match(caller, /permissions:[\s\S]*?pull-requests: write/);
  assert.match(caller, /permissions:[\s\S]*?issues: write/);
  assert.match(caller, /permissions:[\s\S]*?actions: write/);
  assert.match(caller, /permissions:[\s\S]*?checks: read/);
  assert.match(caller, /permissions:[\s\S]*?statuses: write/);
  assert.match(worker, /permissions:[\s\S]*?statuses: write/);
  assert.doesNotMatch(controller, /\n  virtual-train:/);
});
