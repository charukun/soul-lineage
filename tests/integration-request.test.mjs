import test from 'node:test';
import assert from 'node:assert/strict';
import { activeControlRuns, requestDecision } from '../scripts/integration-request.mjs';

const run = (id, status = 'in_progress', branch = 'develop', name = 'Deploy DEV and PROD') => ({ id, status, head_branch: branch, name });

test('active gateway runs are coalesced instead of multiplying controller work', () => {
  assert.deepEqual(activeControlRuns([run(1), run(2, 'completed'), run(3, 'queued'), run(4, 'in_progress', 'main')], 1).map(r => r.id), [3]);
  assert.deepEqual(requestDecision({ runs: [run(7, 'in_progress')] }), { action: 'coalesce', active: [7], control: false });
});

test('no active gateway run admits one Integration Controller', () => {
  assert.deepEqual(requestDecision({ runs: [run(7, 'completed')], control: true }), { action: 'dispatch', active: [], control: true });
});
