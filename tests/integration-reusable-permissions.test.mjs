import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Integration Controller grants every permission required by nested Rescue jobs', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const rescue = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  const caller = controller.match(/\n  rescue:\n[\s\S]*?\n  publisher-handoff:/)?.[0] || '';
  assert.match(caller, /permissions:[\s\S]*?contents: write/);
  assert.match(caller, /permissions:[\s\S]*?pull-requests: write/);
  assert.match(caller, /permissions:[\s\S]*?issues: write/);
  assert.match(caller, /permissions:[\s\S]*?actions: write/);
  assert.match(caller, /permissions:[\s\S]*?checks: read/);
  assert.match(caller, /permissions:[\s\S]*?statuses: write/);
  assert.match(rescue, /virtual-train:[\s\S]*?checks: read/);
});
