import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLICATION_GUIDE_MS,
  boardAlerts,
  devPublicationProgress,
  devPublicationSummary,
  estimatePublicationDuration,
} from '../ops-board/public/health.mjs';

const now = Date.parse('2026-09-15T12:10:00Z');
const baseState = ({ run, integration = {}, dev = {}, alerts = [] } = {}) => ({
  generatedAt: new Date(now).toISOString(),
  alerts,
  environments: [{
    id: 'dev', branchCommit: 'new-head', deployedCommit: 'old-head', exactCommit: true,
    deployState: 'deploying', deployQueue: { commitsAhead: 533 }, url: 'https://example.test/dev/', ...dev,
  }],
  integration: { queue: [], latestRun: run, ...integration },
});

const run = ({ status = 'in_progress', conclusion = null, sha = 'new-head', createdAt = '2026-09-15T12:07:00Z', updatedAt = '2026-09-15T12:09:30Z' } = {}) => ({
  status, conclusion, sha, createdAt, updatedAt, url: 'https://github.com/actions/1',
});

test('DEV publication card replaces raw commit backlog with stage, elapsed time and remaining estimate', () => {
  const state = baseState({
    run: run(),
    integration: { deliveryEstimate: { expectedMs: 7 * 60_000, sampleSize: 8, source: 'recent-success-p75' } },
    alerts: [{ type: 'deploy-wait', tone: 'warning', title: 'DEV 公開待ち', detail: '533 commit 未公開' }],
  });
  const summary = devPublicationSummary(state, now);
  assert.equal(summary.value, 'DEV 公開検証中');
  assert.equal(summary.tone, 'progress');
  assert.match(summary.detail, /マージ済み/);
  assert.match(summary.detail, /3分経過/);
  assert.match(summary.detail, /あと約4分目安/);
  assert.equal(boardAlerts(state, now).some(item => /533 commit 未公開/.test(item.detail || '')), false);
});

test('publication progress explains what is happening, what happens next, and when it should be reviewable', () => {
  const state = baseState({
    run: run(),
    integration: { deliveryEstimate: { expectedMs: 7 * 60_000, sampleSize: 8, source: 'recent-success-p75' } },
  });
  const progress = devPublicationProgress(state, now);
  assert.equal(progress.state, 'publishing');
  assert.match(progress.current, /公開用データを作成・反映/);
  assert.match(progress.next, /公開URL/);
  assert.equal(progress.eta, 'あと約4分目安');
  assert.equal(progress.currentVersionAvailable, true);
  assert.equal(progress.currentCommit, 'old-head');
  assert.equal(progress.nextCommit, 'new-head');
  assert.equal(progress.logUrl, 'https://github.com/actions/1');
});

test('queued current-head publication is shown as a normal wait rather than an action item', () => {
  const state = baseState({ run: run({ status: 'queued' }) });
  const summary = devPublicationSummary(state, now);
  const progress = devPublicationProgress(state, now);
  assert.equal(summary.value, 'DEV 公開待機中');
  assert.equal(summary.tone, 'progress');
  assert.match(progress.current, /順番待ち/);
  assert.match(progress.next, /DEVへ反映/);
});

test('a retry after a failed publication is shown as recovery in progress', () => {
  const state = baseState({ run: run(), integration: { recovering: true } });
  const summary = devPublicationSummary(state, now);
  const progress = devPublicationProgress(state, now);
  assert.equal(summary.value, 'DEV 解消中');
  assert.match(summary.detail, /前回失敗から再試行中/);
  assert.match(progress.current, /自動で再試行/);
  assert.match(progress.next, /公開URL/);
});

test('a current-head publication failure stays an actual action item and explains the recovery path', () => {
  const state = baseState({
    run: run({ status: 'completed', conclusion: 'failure', updatedAt: '2026-09-15T12:09:00Z' }),
    dev: { deployState: 'failed' },
  });
  const summary = devPublicationSummary(state, now);
  const progress = devPublicationProgress(state, now);
  assert.equal(summary.value, 'DEV 公開で問題');
  assert.equal(summary.tone, 'danger');
  assert.match(summary.detail, /再試行待ち/);
  assert.match(progress.current, /問題を検出/);
  assert.match(progress.next, /自動復旧または再試行/);
  assert.match(progress.eta, /復旧開始後/);
});

test('a successful publisher awaiting public manifest convergence is shown separately', () => {
  const state = baseState({
    run: run({ status: 'completed', conclusion: 'success', updatedAt: '2026-09-15T12:09:00Z' }),
    dev: { deployState: 'waiting' },
  });
  const summary = devPublicationSummary(state, now);
  const progress = devPublicationProgress(state, now);
  assert.equal(summary.value, 'DEV 公開反映待ち');
  assert.match(summary.detail, /公開処理は完了/);
  assert.match(progress.current, /公開URLへの反映/);
  assert.match(progress.next, /SHAが一致/);
  assert.match(progress.eta, /反映確認中/);
});

test('an active publisher with no update for ten minutes is promoted to a real delay alert', () => {
  const state = baseState({
    run: run({ createdAt: '2026-09-15T11:55:00Z', updatedAt: new Date(now - PUBLICATION_GUIDE_MS - 1).toISOString() }),
  });
  const summary = devPublicationSummary(state, now);
  const progress = devPublicationProgress(state, now);
  assert.equal(summary.value, 'DEV 公開遅延');
  assert.equal(summary.tone, 'danger');
  assert.match(progress.eta, /通常目安を超過/);
  const alerts = boardAlerts(state, now);
  assert.ok(alerts.some(item => item.type === 'delivery-stalled' && item.tone === 'danger'));
});

test('recent successful DEV publishers produce a conservative p75 wait estimate', () => {
  const durations = [4, 5, 6, 7].map((minutes, index) => ({
    status: 'completed', conclusion: 'success',
    created_at: `2026-09-15T0${index}:00:00Z`,
    updated_at: new Date(Date.parse(`2026-09-15T0${index}:00:00Z`) + minutes * 60_000).toISOString(),
  }));
  const estimate = estimatePublicationDuration(durations);
  assert.equal(estimate.expectedMs, 6 * 60_000);
  assert.equal(estimate.sampleSize, 4);
  assert.equal(estimate.source, 'recent-success-p75');
});

test('publication estimate falls back to the operational ten-minute guide with too little history', () => {
  const estimate = estimatePublicationDuration([]);
  assert.equal(estimate.expectedMs, PUBLICATION_GUIDE_MS);
  assert.equal(estimate.source, 'fallback');
});

test('application UI uses concrete progress language instead of the ambiguous next-update label', () => {
  const source = readFileSync(new URL('../ops-board/public/app-board.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /次の更新/);
  assert.match(source, /確認できる目安/);
  assert.match(source, /現在見えている版/);
  assert.match(source, /反映予定の版/);
  assert.match(source, /いま公開中の版はそのまま開けます/);
});
