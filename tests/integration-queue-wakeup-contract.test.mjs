import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recovery = readFileSync(new URL('../scripts/integration-queue-recovery.mjs', import.meta.url), 'utf8');

test('queue recovery scans the current Ready backlog in one bounded window', () => {
  assert.match(recovery, /limit = 24/);
  assert.match(recovery, /develop verification is running/);
  assert.match(recovery, /inputs: \{ rescue_mode: 'scan' \}/);
});
