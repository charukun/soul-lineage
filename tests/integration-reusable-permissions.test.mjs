import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Integration Controller grants every permission required by reconciliation and nested repair jobs', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const rescue = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  const reconcile = controller.match(/\n  reconcile:\n[\s\S]*?\n  virtual-train:/)?.[0] || '';
  const train = controller.match(/\n  virtual-train:\n[\s\S]*?\n  integrate:/)?.[0] || '';
  const caller = controller.match(/\n  repair:\n[\s\S]*?\n  publisher-handoff:/)?.[0] || '';
  assert.match(reconcile, /permissions:[\s\S]*?contents: write/);
  assert.match(reconcile, /permissions:[\s\S]*?statuses: write/);
  assert.match(train, /permissions:[\s\S]*?checks: read/);
  assert.match(caller, /permissions:[\s\S]*?contents: write/);
  assert.match(caller, /permissions:[\s\S]*?pull-requests: write/);
  assert.match(caller, /permissions:[\s\S]*?issues: write/);
  assert.match(caller, /permissions:[\s\S]*?actions: write/);
  assert.match(caller, /permissions:[\s\S]*?checks: read/);
  assert.match(caller, /permissions:[\s\S]*?statuses: write/);
  assert.doesNotMatch(rescue, /\n  virtual-train:/);
});
