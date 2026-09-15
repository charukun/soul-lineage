import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notifyStage } from '../scripts/implementation-handoff.mjs';
import {
  lifecycleMessage,
  notificationHeadline,
  notificationTitle,
} from '../scripts/notification-copy.mjs';
import { deliveryMessage, recordGithubDeliveryReceipt } from '../scripts/notify-delivery.mjs';

const sha = 'a'.repeat(40);

test('broadcast notification contract is locale-neutral and status-first', () => {
  const message = lifecycleMessage('DEV_DEPLOYED', { fields: {
    phase: 'DELIVERY', outcome: 'VERIFIED', action: 'NONE',
  } });
  assert.match(message, /^\[OK\]\[DEV_DEPLOYED\]\nDEV_DEPLOYED\nseverity: OK\n/);
  assert.match(message, /phase: DELIVERY/);
  assert.match(message, /outcome: VERIFIED/);
  assert.equal(notificationHeadline('INTEGRATED'), '[INFO][INTEGRATED]');
  assert.equal(notificationTitle('FAILED'), 'RINNE [WARN] FAILED');
});

test('delivery contract explicitly separates develop merge from verified DEV publication', () => {
  const integrated = deliveryMessage('INTEGRATED', {
    repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run',
    report: { merged: [{ pr: 260, merge: sha }] }, sha,
  });
  const deployed = deliveryMessage('DEV_DEPLOYED', {
    repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run',
    report: { merged: [] }, sha,
  });
  assert.match(integrated, /^\[INFO\]\[INTEGRATED\]/);
  assert.match(integrated, /\nINTEGRATED\n/);
  assert.match(integrated, /dev_publication: PENDING/);
  assert.match(integrated, /next: DEV_DEPLOYED\|FAILED/);
  assert.match(deployed, /^\[OK\]\[DEV_DEPLOYED\]/);
  assert.match(deployed, /\nDEV_DEPLOYED\n/);
  assert.match(deployed, /outcome: VERIFIED/);
  assert.match(deployed, /action: NONE/);
});

test('ntfy receives the same locale-neutral status contract in title and body', async () => {
  let request;
  const result = await notifyStage(lifecycleMessage('DEV_DEPLOYED'), {
    url: 'https://ntfy.example/topic',
    title: notificationTitle('DEV_DEPLOYED'),
    request: async (_url, options) => { request = options; return { ok: true }; },
  });
  assert.equal(result, 'ntfy');
  assert.equal(request.headers.Title, 'RINNE [OK] DEV_DEPLOYED');
  assert.match(request.body, /^\[OK\]\[DEV_DEPLOYED\]/);
});

test('verified DEV publication creates one deduplicatable GitHub PR receipt', async () => {
  let posted = '';
  const response = (payload, status = 200) => ({ ok: true, status, json: async () => payload });
  const request = async (url, options = {}) => {
    if (url.includes(`/commits/${sha}/pulls`)) return response([{ number: 311, merged_at: '2026-09-15T14:00:00Z', base: { ref: 'develop' } }]);
    if (url.includes('/issues/311/comments?')) return response([]);
    if (url.endsWith('/issues/311/comments') && options.method === 'POST') {
      posted = JSON.parse(options.body).body;
      return response({ id: 1 }, 201);
    }
    throw new Error(`unexpected request: ${options.method || 'GET'} ${url}`);
  };
  const message = lifecycleMessage('DEV_DEPLOYED', { fields: { outcome: 'VERIFIED' } });
  const result = await recordGithubDeliveryReceipt({
    token: 'token', repository: 'charukun/soul-lineage', sha,
    runUrl: 'https://github.com/charukun/soul-lineage/actions/runs/1', message, request,
  });
  assert.equal(result, 'github-pr-comment');
  assert.match(posted, /dev-delivery-receipt:/);
  assert.match(posted, /\[OK\]\[DEV_DEPLOYED\]/);
  assert.match(posted, /receipt: VERIFIED_DEV_PUBLICATION/);
});

test('browser repair comments and issue titles use the same locale-neutral status vocabulary', () => {
  const source = readFileSync('scripts/browser-repair-ticket.mjs', 'utf8');
  assert.match(source, /notificationHeadline\(issueStage\)/);
  assert.match(source, /lifecycleMessage\(visibleStage/);
  assert.doesNotMatch(source, /NOTIFY_LOCALE|normalizeNotificationLocale/);
});

test('workflow exposes no broadcast locale setting', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const handoff = readFileSync('scripts/implementation-handoff.mjs', 'utf8');
  const delivery = readFileSync('scripts/notify-delivery.mjs', 'utf8');
  assert.doesNotMatch(ci, /NOTIFY_LOCALE/);
  assert.doesNotMatch(handoff, /NOTIFY_LOCALE|normalizeNotificationLocale/);
  assert.doesNotMatch(delivery, /NOTIFY_LOCALE|normalizeNotificationLocale/);
});
