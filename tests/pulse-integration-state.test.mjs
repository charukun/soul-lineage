import test from 'node:test';
import assert from 'node:assert/strict';
import { STALL_WARNING_MS, classifyPull, overallIntegration } from '../ops-board/model.mjs';

const ciRun = (sha, time) => ({
  name: 'CI', head_sha: sha, status: 'completed', conclusion: 'success',
  updated_at: time, created_at: time, html_url: 'https://github.com/actions/ci',
});

test('explicit Integration holds never become stale merge-ready alerts', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  const old = new Date(now - STALL_WARNING_MS * 3).toISOString();
  const pr = {
    number: 7, title: 'Held', html_url: 'https://github.com/x/y/pull/7', draft: false,
    labels: [{ name: 'integration:hold' }], body: 'Depends-On: none', head: { sha: 'head' }, updated_at: old,
  };
  const state = classifyPull(pr, [ciRun('head', old)], [], now);
  assert.equal(state.stage, 'HOLD');
  assert.equal(state.warning, undefined);
  assert.equal(state.tone, 'info');
});

test('an active delivery workflow is not mislabeled as Integration and exposes heartbeat', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  const heartbeat = new Date(now - 60_000).toISOString();
  const state = overallIntegration([], { status: 'in_progress', updated_at: heartbeat }, [], now);
  assert.equal(state.label, 'DEV delivery中');
  assert.equal(state.phase, 'delivery');
  assert.equal(state.heartbeatAt, heartbeat);
  assert.equal(state.stalled, false);
});

test('PULSE flags a delivery workflow whose heartbeat is stale', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  const heartbeat = new Date(now - STALL_WARNING_MS - 1_000).toISOString();
  const state = overallIntegration([], { status: 'in_progress', updated_at: heartbeat }, [], now);
  assert.equal(state.label, 'DEV delivery停止疑い');
  assert.equal(state.tone, 'danger');
  assert.equal(state.stalled, true);
});
