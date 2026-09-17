import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  appendControlHistory,
  deriveControlTower,
  publicationHistoryEntry,
} from '../ops-board/control-tower.mjs';
import { deliverControlNotification, notifyControlState } from '../ops-board/control-notify.mjs';

const base = () => ({
  schemaVersion: 2,
  generatedAt: '2026-09-18T00:00:00Z',
  syncStatus: 'ok',
  syncReason: 'github-event:pr-event',
  alerts: [],
  pullSync: { complete: true },
  pullRequests: { normal: [], truncated: false, targetLookup: { pending: 0 } },
  integration: { queue: [], recovering: false, latestRun: null },
  environments: [{
    id: 'dev', branchCommit: 'a'.repeat(40), deployedCommit: 'a'.repeat(40), exactCommit: true,
    deployState: 'success', deployedAt: '2026-09-17T23:59:00Z', url: 'https://example.test/dev/',
  }],
  publicManifest: { validatedDevelop: 'a'.repeat(40) },
});

test('idle current PULSE is a single SYNCED state with no user action', () => {
  const control = deriveControlTower(base());
  assert.equal(control.status, 'SYNCED');
  assert.equal(control.headline, '放置でOK');
  assert.equal(control.userActionRequired, false);
  assert.equal(control.completeness.state, 'confirmed');
  assert.ok(control.flow.some(step => step.id === 'publication' && step.state === 'done'));
});

test('normal implementation and publication activity stays PROCESSING instead of red', () => {
  const state = base();
  state.pullRequests.normal = [{ state: 'Draft', updatedAt: '2026-09-18T00:00:00Z' }];
  state.environments[0].branchCommit = 'b'.repeat(40);
  state.environments[0].deployState = 'waiting';
  state.environments[0].deployQueue = { commitsAhead: 1 };
  const control = deriveControlTower(state);
  assert.equal(control.status, 'PROCESSING');
  assert.equal(control.headline, '放置でOK');
  assert.equal(control.userActionRequired, false);
});

test('automatic degraded retry is RECOVERING and auth-required is NEEDS_USER', () => {
  const transient = base();
  transient.syncStatus = 'degraded';
  transient.syncError = 'HTTP 500';
  transient.nextRetryAt = '2026-09-18T00:05:00Z';
  transient.githubFailure = { kind: 'http' };
  assert.equal(deriveControlTower(transient).status, 'RECOVERING');

  const auth = base();
  auth.syncStatus = 'degraded';
  auth.syncError = 'github_auth_required';
  auth.githubFailure = { kind: 'auth-required' };
  auth.alerts = [{ type: 'github-sync-degraded', tone: 'warning', title: 'GitHub履歴の更新に失敗', detail: 'auth' }];
  const control = deriveControlTower(auth);
  assert.equal(control.status, 'NEEDS_USER');
  assert.equal(control.notification.shouldNotify, true);
  assert.equal(control.incidents[0].impact, 'pulse');
});

test('action notification decision deduplicates while the same incident remains active', () => {
  const state = base();
  state.alerts = [{ type: 'branch-diverged', environment: 'prod', tone: 'danger', title: 'Production 系譜確認', detail: 'diverged' }];
  const first = deriveControlTower(state);
  const second = deriveControlTower(state, first);
  assert.equal(first.notification.shouldNotify, true);
  assert.equal(second.notification.shouldNotify, false);
  assert.equal(second.enteredAt, first.enteredAt);
  assert.deepEqual(first.impactLabels, ['Production']);
});

test('bounded history deduplicates states and records DEV publication time/duration', () => {
  const state = base();
  state.integration.latestRun = {
    sha: 'a'.repeat(40), status: 'completed', conclusion: 'success',
    createdAt: '2026-09-17T23:55:00Z', updatedAt: '2026-09-17T23:59:00Z',
  };
  state.controlTower = deriveControlTower(state);
  let history = appendControlHistory(null, state);
  history = appendControlHistory(history, state);
  assert.equal(history.snapshots.length, 1);
  assert.equal(history.publications.length, 1);
  assert.equal(history.publications[0].durationMs, 4 * 60_000);
  assert.equal(publicationHistoryEntry(state).publishedAt, '2026-09-17T23:59:00Z');
});

test('notification transport only sends when the shared decision requests it', async () => {
  let calls = 0;
  const request = async (_url, options) => {
    calls++;
    assert.match(options.body, /PULSE/);
    return { ok: true, status: 200 };
  };
  assert.equal(await notifyControlState({ controlTower: { notification: { shouldNotify: false } } }, { url: 'https://notify.test/', request }), 'skipped');
  assert.equal(calls, 0);
  const state = { controlTower: { notification: { shouldNotify: true, title: 'PULSE 確認が必要', body: 'PULSEで確認が必要です' } } };
  assert.equal(await notifyControlState(state, { url: 'https://notify.test/', request }), 'ntfy');
  assert.equal(calls, 1);
});

test('action notification lease prevents duplicate concurrent delivery paths', async () => {
  const calls = [];
  const request = async (url) => {
    const value = String(url);
    calls.push(value);
    if (value.includes('/claim')) return { ok: true, status: 200, json: async () => ({ claimed: true }) };
    if (value.includes('/complete')) return { ok: true, status: 200, json: async () => ({ accepted: true }) };
    return { ok: true, status: 200 };
  };
  const state = { controlTower: { notification: { shouldNotify: true, key: 'incident:1', title: 'PULSE', body: 'PULSE action' } } };
  const result = await deliverControlNotification(state, {
    notificationUrl: 'https://notify.test/',
    refreshToken: 'refresh-token',
    request,
  });
  assert.equal(result, 'ntfy');
  assert.equal(calls.filter(value => value === 'https://notify.test/').length, 1);
  assert.ok(calls.some(value => value.endsWith('/api/action-notification/claim')));
  assert.ok(calls.some(value => value.endsWith('/api/action-notification/complete')));
});

test('public UI exposes action-first control tower, previous-view delta, flow and publication history', () => {
  const html = readFileSync(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../ops-board/public/control-tower.js', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../ops-board/worker.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="control-tower"/);
  assert.match(html, /id="control-delta"/);
  assert.match(html, /id="control-flow"/);
  assert.match(html, /公開履歴と時間/);
  assert.match(html, /id="publication-history"/);
  assert.match(html, /id="history-replay"/);
  assert.match(ui, /rinne-ops:last-seen:v2/);
  assert.match(ui, /DEV公開更新/);
  assert.match(ui, /公開処理/);
  assert.match(worker, /ops-history-v1/);
  assert.match(worker, /\/api\/history/);
  assert.match(worker, /action-notification\/claim/);
});
