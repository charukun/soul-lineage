import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Fast Lane merge wakes one bounded Repair scan for newly-unblocked dependencies', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const wake = controller.match(/\n  continue-dependent-chain:\n[\s\S]*$/)?.[0] || '';

  assert.match(wake, /name: Wake next dependent Repair scan/);
  assert.match(wake, /needs: \[integrate, repair\]/);
  assert.match(wake, /needs\.integrate\.outputs\.merged_count != '0'/);
  assert.match(wake, /permissions:[\s\S]*?actions: write/);
  assert.match(wake, /permissions:[\s\S]*?contents: read/);
  assert.match(wake, /createWorkflowDispatch/);
  assert.match(wake, /workflow_id: 'deploy\.yml'/);
  assert.match(wake, /ref: 'develop'/);
  assert.match(wake, /rescue_mode: 'scan'/);
  assert.match(wake, /integration_cursor: '0'/);
  assert.doesNotMatch(wake, /setInterval|setTimeout|sleep\s|watch\s/);
});
