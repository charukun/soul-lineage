import test from 'node:test';
import assert from 'node:assert/strict';
import { controlPlaneHealth, workflowPressure } from '../ops-board/control-plane.mjs';

test('control plane health separates notification misconfiguration, canary and coalesced wake', () => {
  const health = controlPlaneHealth({ statuses: [
    { context: 'notification/ntfy', state: 'error', description: 'NTFY_TOPIC_URL is not configured; smartphone delivery unconfirmed' },
    { context: 'integration/canary', state: 'success', description: 'ok' },
    { context: 'integration/wakeup', state: 'pending', description: 'coalesced' },
  ] });
  assert.equal(health.notification.label, 'MISCONFIGURED');
  assert.equal(health.canary.label, 'HEALTHY');
  assert.equal(health.wakeup.label, 'COALESCED');
});

test('workflow pressure counts cancelled and duplicate develop runs in 24h', () => {
  const now = Date.now();
  const created = new Date(now - 1000).toISOString();
  const runs = [
    { head_sha: 'a', event: 'workflow_dispatch', status: 'completed', conclusion: 'success', created_at: created },
    { head_sha: 'a', event: 'workflow_dispatch', status: 'completed', conclusion: 'cancelled', created_at: created },
    { head_sha: 'b', event: 'push', status: 'in_progress', conclusion: null, created_at: created },
  ];
  assert.deepEqual(workflowPressure(runs, now), { runs24h: 3, active: 1, cancelled: 1, duplicateRuns: 1 });
});
