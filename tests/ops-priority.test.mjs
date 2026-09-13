import test from 'node:test';
import assert from 'node:assert/strict';
import { boardAlerts, pullProgress } from '../ops-board/public/health.mjs';

const now = Date.parse('2026-09-13T07:00:00Z');
const fresh = { generatedAt: new Date(now).toISOString(), syncStatus: 'ok' };

test('collapsed publication, Actions and Rescue failures remain visible as current problems', () => {
  const state = { ...fresh,
    applications: [{ name: '輪廻転焦', targets: [{ label: '開発', state: 'success', updateState: 'failed' }] }],
    recentActionFailures: [{ workflow: 'Publish', conclusion: 'failure', url: 'https://example.com/run/1' }, { conclusion: 'cancelled' }],
    integrationRescue: { available: true, generatedAt: fresh.generatedAt, counts: { manual: 1 }, manual: [{ pr: 2 }], workers: [] },
  };
  const alerts = boardAlerts(state, now);
  assert.equal(alerts.length, 3);
  assert.match(alerts.find(item => item.type === 'publication-failed').detail, /前の版は公開中/);
  assert.equal(alerts.find(item => item.type === 'rescue-manual').section, '#rescue-section');
  assert.equal(boardAlerts({ ...state, alerts }, now).length, 3);
});

test('the same failed run is not duplicated and cancellation alone is not a problem', () => {
  const url = 'https://example.com/run/1';
  assert.equal(boardAlerts({ ...fresh, alerts: [{ type: 'integration-failed', url }], recentActionFailures: [{ conclusion: 'failure', url }] }, now).length, 1);
  assert.equal(boardAlerts({ ...fresh, recentActionFailures: [{ conclusion: 'cancelled' }] }, now).length, 0);
});

test('old Rescue evidence and expired worker heartbeats cannot appear healthy', () => {
  const alerts = boardAlerts({ ...fresh, integrationRescue: { available: true, generatedAt: new Date(now - 20 * 60000).toISOString(),
    counts: {}, workers: [{ heartbeatAt: new Date(now - 13 * 60000).toISOString() }], staleMs: 10 * 60000 } }, now);
  assert.ok(alerts.some(item => item.type === 'rescue-observation'));
  assert.ok(alerts.some(item => item.type === 'rescue-stale'));
});

test('task progress uses exact current head and never calls an integrated PR published', () => {
  const pr = { number: 7, headSha: 'current', state: 'Ready' };
  const queue = [{ number: 7, headSha: 'old', label: 'CI失敗', tone: 'danger' }];
  assert.equal(pullProgress(pr, { queue }).tone, 'info');
  queue[0].headSha = 'current';
  assert.equal(pullProgress(pr, { queue }).label, 'CI失敗');
  assert.equal(pullProgress({ ...pr, state: 'Merged' }, { queue }), null);
  assert.equal(pullProgress({ ...pr, state: 'Draft' }, { queue }), null);
});
