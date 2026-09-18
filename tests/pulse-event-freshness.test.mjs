import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventDrivenAlerts, syncPresentation } from '../ops-board/public/freshness.mjs';

const now = Date.parse('2026-09-18T03:00:00Z');
const healthyState = generatedAt => ({
  generatedAt,
  syncStatus: 'ok',
  alerts: [],
  environments: [],
  integration: { queue: [] },
});

test('elapsed time alone does not become a PULSE action item', () => {
  const state = healthyState(new Date(now - 3 * 60 * 60 * 1000).toISOString());
  const alerts = eventDrivenAlerts(state, now);
  assert.equal(alerts.some(item => item.type === 'sync-stale'), false);
  assert.equal(alerts.some(item => /更新が遅れています/.test(item.title || '')), false);

  const presentation = syncPresentation(state, now);
  assert.equal(presentation.tone, 'ok');
  assert.equal(presentation.title, '同期済み');
  assert.match(presentation.meta, /3時間0分前/);
  assert.match(presentation.meta, /イベント駆動/);
});

test('real sync degradation stays visible as automatic recovery while previous facts remain available', () => {
  const state = {
    ...healthyState(new Date(now - 5 * 60 * 1000).toISOString()),
    syncStatus: 'degraded',
    syncError: 'GitHub refresh failed',
  };
  const alerts = eventDrivenAlerts(state, now);
  assert.equal(alerts.length, 0, 'automatic sync recovery must not become a human-action alert');
  const presentation = syncPresentation(state, now);
  assert.equal(presentation.tone, 'warning');
  assert.equal(presentation.title, '再同期中');
  assert.match(presentation.meta, /最終確定/);
});

test('Control Tower NEEDS_USER keeps a true human-action sync problem red', () => {
  const state = {
    ...healthyState(new Date(now - 5 * 60 * 1000).toISOString()),
    syncStatus: 'degraded',
    controlTower: {
      status: 'NEEDS_USER',
      summary: 'GitHub認証を確認してください',
      incidents: [{ type: 'github-auth', tone: 'danger', title: '認証が必要', userActionRequired: true }],
    },
  };
  const presentation = syncPresentation(state, now);
  assert.equal(presentation.tone, 'danger');
  assert.equal(presentation.title, '確認が必要');
  assert.match(presentation.meta, /認証/);
  assert.equal(eventDrivenAlerts(state, now).length, 1);
});

test('missing snapshot identity remains a visible confirmation state', () => {
  const presentation = syncPresentation(healthyState(null), now);
  assert.equal(presentation.tone, 'warning');
  assert.equal(presentation.title, '同期確認中');
});

test('PULSE UI explains event-driven sync and browser reload without implying a GitHub refresh', () => {
  const html = readFileSync(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../ops-board/public/app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../ops-board/public/review-polish.css', import.meta.url), 'utf8');

  assert.match(html, /data-sync-title/);
  assert.match(html, /data-sync-meta/);
  assert.match(html, />再読込<\/button>/);
  assert.doesNotMatch(html, />最新に更新<\/button>/);
  assert.match(app, /syncPresentation/);
  assert.match(app, /eventDrivenAlerts/);
  assert.doesNotMatch(app, /age\s*>=\s*STALE_SNAPSHOT_MS/);
  assert.match(css, /\.sync-freshness\.ok/);
  assert.match(css, /\.sync-dot/);
});

test('GitHub state events wake the one shared authenticated refresh path', () => {
  const wake = readFileSync(new URL('../.github/workflows/pulse-events.yml', import.meta.url), 'utf8');
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  for (const event of ['synchronize', 'closed', 'ready_for_review', 'converted_to_draft', 'review_requested']) {
    assert.match(wake, new RegExp(`\\b${event}\\b`));
  }
  assert.match(wake, /pull_request_review:/);
  assert.match(wake, /submitted, edited, dismissed/);
  assert.match(wake, /uses:\s*\.\/\.github\/workflows\/pulse-refresh\.yml/);
  assert.match(wake, /reason:\s*pr-event/);
  assert.doesNotMatch(wake, /api\/refresh|\bcurl\b/);

  assert.match(ci, /branches:\s*\[main\]/);
  assert.match(ci, /develop PRs intentionally do not trigger GitHub CI/);
  assert.doesNotMatch(ci, /pulse-result-refresh:/);
  assert.doesNotMatch(ci, /Refresh PULSE after PR checks/);
  assert.doesNotMatch(ci, /uses:\s*\.\/\.github\/workflows\/pulse-refresh\.yml/);
  assert.doesNotMatch(ci, /reason:\s*pr-event/);
});