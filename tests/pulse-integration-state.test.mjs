import test from 'node:test';
import assert from 'node:assert/strict';
import { STALL_WARNING_MS, classifyPull, overallIntegration } from '../ops-board/model.mjs';
import { actionProblems } from '../ops-board/review-model.mjs';

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

test('verified exact DEV publication is not overwritten by a later advisory workflow failure', () => {
  const run = { status: 'completed', conclusion: 'failure', updated_at: '2026-09-15T00:00:00Z' };
  const verified = overallIntegration([], run, [], Date.parse('2026-09-15T00:01:00Z'), { deliveryVerified: true });
  assert.equal(verified.label, '正常');
  assert.equal(verified.tone, 'ok');
  const unverified = overallIntegration([], run, [], Date.parse('2026-09-15T00:01:00Z'), { deliveryVerified: false });
  assert.equal(unverified.label, 'Failed');
  assert.equal(unverified.tone, 'danger');
});

test('failed develop workflow moves to history when the exact SHA is already publicly verified', () => {
  const sha = 'a'.repeat(40);
  const run = { id: 1, workflow_id: 2, name: 'Deploy DEV and PROD', head_branch: 'develop', head_sha: sha,
    event: 'push', status: 'completed', conclusion: 'failure', created_at: '2026-09-15T00:00:00Z' };
  const result = actionProblems([run], [], { verifiedDevelopSha: sha });
  assert.equal(result.current.length, 0);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].historyLabel, 'DEV公開検証済み・補助処理の記録');
});
