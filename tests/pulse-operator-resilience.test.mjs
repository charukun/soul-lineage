import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE first-glance UI has no leaked source escape and exposes the three operator decisions', () => {
  const html = text('ops-board/public/index.html');
  assert.doesNotMatch(html, />\\n\s*<link rel="stylesheet" href="\.\/rapid-ui\.css">/);
  const action = html.indexOf('id="overview-alert-card"');
  const task = html.indexOf('id="overview-task-card"');
  const dev = html.indexOf('id="overview-app-card"');
  assert.ok(action > 0 && action < task && task < dev);
  assert.match(html, /あなたの操作/);
  assert.match(html, /<span class="overview-label">DEV<\/span>/);
});

test('PULSE browser keeps a bounded last-known-good snapshot for transient API outages', () => {
  const view = text('ops-board/public/view-state.js');
  assert.match(view, /rinne-ops:last-known-good:v1/);
  assert.match(view, /SNAPSHOT_STORAGE_LIMIT = 1_500_000/);
  assert.match(view, /writeCachedSnapshot\(data\)/);
  assert.match(view, /if \(!snapshot\) snapshot = readCachedSnapshot\(\)/);
});

test('PULSE operator flow is presentation-compressed to four stages', () => {
  const tower = text('ops-board/public/control-tower.js');
  for (const id of ["work","ready","integration","dev"]) assert.match(tower, new RegExp(`id:'${id}'`));
  assert.doesNotMatch(tower, /id:'pulse'/);
  assert.match(tower, /あなたの操作は不要です/);
});

test('PULSE Worker uses stable Durable Object namespace access and returns structured degraded state', () => {
  const worker = text('ops-board/worker.mjs');
  assert.match(worker, /namespace\.get\(namespace\.idFromName\('global'\)\)/);
  assert.match(worker, /resilientPublicState/);
  assert.match(worker, /runtimeFallback: true/);
  assert.match(worker, /refreshFailed: true/);
  assert.doesNotMatch(worker, /env\.OPS_STATE\.getByName\('global'\)/);
});
