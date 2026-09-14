import test from 'node:test';
import assert from 'node:assert/strict';
import { controlPlaneHealth, workflowPressure, queueLatency } from '../ops-board/control-plane.mjs';

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

test('workflow pressure counts cancelled and duplicate control runs in 24h', () => {
  const now = Date.now();
  const created = new Date(now - 1000).toISOString();
  const runs = [
    { name: 'Integration Controller', head_sha: 'a', event: 'workflow_dispatch', status: 'completed', conclusion: 'success', created_at: created },
    { name: 'Integration Controller', head_sha: 'a', event: 'workflow_dispatch', status: 'completed', conclusion: 'cancelled', created_at: created },
    { name: 'Deploy DEV and PROD', head_sha: 'b', event: 'push', status: 'in_progress', conclusion: null, created_at: created },
  ];
  assert.deepEqual(workflowPressure(runs, now), { runs24h: 3, active: 1, cancelled: 1, duplicateRuns: 1 });
});

test('queue latency exposes oldest, p50 and p95 Ready wait', () => {
  const now = Date.parse('2026-09-14T08:00:00Z');
  const queue = [1, 5, 10, 40].map(minutes => ({ eligibleSince: new Date(now - minutes * 60000).toISOString() }));
  assert.deepEqual(queueLatency(queue, now), { sample: 4, oldestMinutes: 40, p50Minutes: 5, p95Minutes: 40 });
});
