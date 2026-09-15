import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notifyStage } from '../scripts/implementation-handoff.mjs';
import {
  lifecycleMessage,
  notificationHeadline,
  notificationTitle,
} from '../scripts/notification-copy.mjs';
import {
  deliveryMessage,
  devChangeEmailMessage,
  findAssociatedDevelopPr,
  recordGithubDeliveryReceipt,
} from '../scripts/notify-delivery.mjs';

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
    locale: 'ja', repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run', sha,
    pr: { number: 348, title: '戦闘テンポを少し遅くする修正' },
  });
  assert.match(integrated, /^\[INFO\]\[INTEGRATED\]/);
  assert.match(integrated, /\nINTEGRATED\n/);
  assert.match(integrated, /dev_publication: PENDING/);
  assert.match(integrated, /next: DEV_DEPLOYED\|FAILED/);
  assert.match(deployed, /^\[OK\]\[DEV_DEPLOYED\]/);
  assert.match(deployed, /\nDEV_DEPLOYED\n/);
  assert.match(deployed, /outcome: VERIFIED/);
  assert.match(deployed, /action: NONE/);
  assert.match(deployed, /verification: FAST_CHECKS\+DEV_PUBLIC\+HTTP_SOURCE/);
  assert.match(deployed, /browser: ASYNC_DIAGNOSTICS/);
  assert.doesNotMatch(deployed, /FOCUSED_BROWSER/);
  assert.doesNotMatch(deployed, /戦闘テンポ/);
  assert.doesNotMatch(deployed, /DEVで確認できます/);
});

test('development email copy is short and shows the associated PR title and DEV entry point', () => {
  const email = devChangeEmailMessage({
    locale: 'ja', repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run', sha,
    pr: { number: 348, title: '戦闘テンポを少し遅くする修正' },
  });
  assert.match(email, /^DEV反映完了\n/);
  assert.match(email, /修正内容: 戦闘テンポを少し遅くする修正/);
  assert.match(email, /DEVで確認できます。/);
  assert.match(email, /https:\/\/charukun\.github\.io\/soul-lineage\/dev\//);
  assert.match(email, /PR: https:\/\/github\.com\/charukun\/soul-lineage\/pull\/348/);
  assert.doesNotMatch(email, /\[DEV_DEPLOYED\]/);
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

test('ntfy receives the same locale-neutral status contract in title and body', async () => {
  let request;
  const body = deliveryMessage('DEV_DEPLOYED', {
    locale: 'ja', repository: 'charukun/soul-lineage', runUrl: 'https://github.com/run', sha,
  });
  const result = await notifyStage(body, {
    url: 'https://ntfy.example/topic',
    title: notificationTitle('DEV_DEPLOYED'),
    request: async (_url, options) => { request = options; return { ok: true }; },
  });
  assert.equal(result, 'ntfy');
  assert.equal(request.headers.Title, 'RINNE [OK] DEV_DEPLOYED');
  assert.match(request.body, /^\[OK\]\[DEV_DEPLOYED\]/);
  assert.doesNotMatch(request.body, /DEVで確認できます/);
});

test('verified DEV publication creates one deduplicatable PR comment that triggers developer email', async () => {
  let posted = '';
  const pr = {
    number: 311,
    title: '戦闘テンポを少し遅くする修正',
    merged_at: '2026-09-15T14:00:00Z',
    base: { ref: 'develop' },
    user: { login: 'charukun' },
  };
  const response = (payload, status = 200) => ({ ok: true, status, json: async () => payload });
  const request = async (url, options = {}) => {
    if (url.includes(`/commits/${sha}/pulls`)) return response([pr]);
    if (url.includes('/issues/311/comments?')) return response([]);
    if (url.endsWith('/issues/311/comments') && options.method === 'POST') {
      posted = JSON.parse(options.body).body;
      return response({ id: 1 }, 201);
    }
    throw new Error(`unexpected request: ${options.method || 'GET'} ${url}`);
  };
  const message = devChangeEmailMessage({
    pr, sha, repository: 'charukun/soul-lineage',
    runUrl: 'https://github.com/charukun/soul-lineage/actions/runs/1', locale: 'ja',
  });
  const result = await recordGithubDeliveryReceipt({
    token: 'token', repository: 'charukun/soul-lineage', sha,
    runUrl: 'https://github.com/charukun/soul-lineage/actions/runs/1', message, request,
  });
  assert.equal(result, 'github-pr-comment');
  assert.match(posted, /dev-delivery-receipt:/);
  assert.match(posted, /@charukun/);
  assert.match(posted, /DEV反映完了/);
  assert.match(posted, /修正内容: 戦闘テンポを少し遅くする修正/);
  assert.match(posted, /GitHub PR subscription\/mention provides the email notification/);
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
