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
import { deliveryMessage } from '../scripts/notify-delivery.mjs';

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

test('browser repair comments and issue titles use the same visible status vocabulary', () => {
  const source = readFileSync('scripts/browser-repair-ticket.mjs', 'utf8');
  assert.match(source, /notificationHeadline\(issueStage, notificationLocale\)/);
  assert.match(source, /notificationHeadline\(conclusion === 'failure' \? 'FAILED' : 'BROWSER_VERIFIED'/);
});
