import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notifyStage } from '../scripts/implementation-handoff.mjs';
import {
  lifecycleMessage,
  normalizeNotificationLocale,
  notificationHeadline,
  notificationTitle,
} from '../scripts/notification-copy.mjs';
import { deliveryMessage, findAssociatedDevelopPr, recordGithubDeliveryReceipt } from '../scripts/notify-delivery.mjs';

const sha = 'a'.repeat(40);

test('notification locale accepts Japanese variants and safely falls back to English', () => {
  assert.equal(normalizeNotificationLocale('ja-JP'), 'ja');
  assert.equal(normalizeNotificationLocale('ja_JP'), 'ja');
  assert.equal(normalizeNotificationLocale('en-US'), 'en');
  assert.equal(normalizeNotificationLocale('fr-FR'), 'en');
});

test('lifecycle copy keeps stable machine status codes while localizing the human headline', () => {
  const ja = lifecycleMessage('DEV_DEPLOYED', { locale: 'ja-JP' });
  const en = lifecycleMessage('DEV_DEPLOYED', { locale: 'en-US' });
  assert.match(ja, /^\[OK\]\[DEV_DEPLOYED\] DEV反映・検証済み\nDEV_DEPLOYED\n/);
  assert.match(en, /^\[OK\]\[DEV_DEPLOYED\] DEV published and verified\nDEV_DEPLOYED\n/);
  assert.equal(notificationHeadline('INTEGRATED', 'ja'), '[INFO][INTEGRATED] developへ統合済み / DEV公開は未確認');
  assert.equal(notificationTitle('FAILED'), 'RINNE [WARN] FAILED');
});

test('delivery copy explicitly separates develop merge from verified DEV publication', () => {
  const integrated = deliveryMessage('INTEGRATED', {
    locale: 'ja', repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run',
    report: { merged: [{ pr: 260, merge: sha }] }, sha,
  });
  const deployed = deliveryMessage('DEV_DEPLOYED', {
    locale: 'ja', repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run',
    report: { merged: [] }, sha,
  });
  assert.match(integrated, /developへ統合済み \/ DEV公開は未確認/);
  assert.match(integrated, /\nINTEGRATED\n/);
  assert.match(deployed, /DEV反映・検証済み/);
  assert.match(deployed, /\nDEV_DEPLOYED\n/);
  assert.doesNotMatch(deployed, /DEVで確認できます/);
});

test('verified DEV notification shows the associated PR title and DEV entry point', () => {
  const deployed = deliveryMessage('DEV_DEPLOYED', {
    locale: 'ja', repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run', sha,
    pr: { number: 348, title: '戦闘テンポを少し遅くする修正' },
  });
  assert.match(deployed, /結果: 戦闘テンポを少し遅くする修正 をDEVへ反映しました。/);
  assert.match(deployed, /次: DEVで確認できます。/);
  assert.match(deployed, /PR: https:\/\/github\.com\/charukun\/soul-lineage\/pull\/348/);
  assert.match(deployed, /DEV: https:\/\/charukun\.github\.io\/soul-lineage\/dev\//);
});

test('associated develop PR lookup selects the newest merged develop PR', async () => {
  const response = payload => ({ ok: true, status: 200, json: async () => payload });
  const request = async url => {
    assert.match(url, new RegExp(`/commits/${sha}/pulls\\?per_page=100$`));
    return response([
      { number: 10, title: 'old', merged_at: '2026-09-15T10:00:00Z', base: { ref: 'develop' } },
      { number: 11, title: 'main only', merged_at: '2026-09-15T13:00:00Z', base: { ref: 'main' } },
      { number: 12, title: 'new', merged_at: '2026-09-15T12:00:00Z', base: { ref: 'develop' } },
    ]);
  };
  const pr = await findAssociatedDevelopPr({
    token: 'token', repository: 'charukun/soul-lineage', sha, request,
  });
  assert.equal(pr.number, 12);
  assert.equal(pr.title, 'new');
});

test('ntfy receives an ASCII status title while localized detail remains in the body', async () => {
  let request;
  const result = await notifyStage('[OK][DEV_DEPLOYED] DEV反映・検証済み', {
    url: 'https://ntfy.example/topic',
    title: notificationTitle('DEV_DEPLOYED'),
    request: async (_url, options) => { request = options; return { ok: true }; },
  });
  assert.equal(result, 'ntfy');
  assert.equal(request.headers.Title, 'RINNE [OK] DEV_DEPLOYED');
  assert.match(request.body, /DEV反映・検証済み/);
});

test('verified DEV publication creates one deduplicatable GitHub PR receipt', async () => {
  let posted = '';
  const response = (payload, status = 200) => ({ ok: true, status, json: async () => payload });
  const request = async (url, options = {}) => {
    if (url.includes(`/commits/${sha}/pulls`)) return response([{ number: 311, title: 'DEV fix', merged_at: '2026-09-15T14:00:00Z', base: { ref: 'develop' } }]);
    if (url.includes('/issues/311/comments?')) return response([]);
    if (url.endsWith('/issues/311/comments') && options.method === 'POST') {
      posted = JSON.parse(options.body).body;
      return response({ id: 1 }, 201);
    }
    throw new Error(`unexpected request: ${options.method || 'GET'} ${url}`);
  };
  const message = lifecycleMessage('DEV_DEPLOYED', { locale: 'ja' });
  const result = await recordGithubDeliveryReceipt({
    token: 'token', repository: 'charukun/soul-lineage', sha,
    runUrl: 'https://github.com/charukun/soul-lineage/actions/runs/1', message, request,
  });
  assert.equal(result, 'github-pr-comment');
  assert.match(posted, /dev-delivery-receipt:/);
  assert.match(posted, /\[OK\]\[DEV_DEPLOYED\] DEV反映・検証済み/);
});

test('browser repair comments and issue titles use the same visible status vocabulary', () => {
  const source = readFileSync('scripts/browser-repair-ticket.mjs', 'utf8');
  assert.match(source, /notificationHeadline\(issueStage, notificationLocale\)/);
  assert.match(source, /notificationHeadline\(conclusion === 'failure' \? 'FAILED' : 'BROWSER_VERIFIED'/);
});
