import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PULSE_FIRST_GLANCE, PULSE_ROLE, PULSE_COPY } from '../apps/pulse/public/pulse-contract.mjs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE first-glance UI has no leaked source escape and follows the semantic role contract', () => {
  const html = text('apps/pulse/public/index.html');
  assert.doesNotMatch(html, />\\n\s*<link rel="stylesheet" href="\.\/rapid-ui\.css">/);
  assert.deepEqual(PULSE_FIRST_GLANCE, [
    PULSE_ROLE.DEVELOPMENT,
    PULSE_ROLE.DEV_PUBLICATION,
    PULSE_ROLE.HUMAN_ACTION,
    PULSE_ROLE.RECENT,
  ]);
  const positions = PULSE_FIRST_GLANCE.map(role => html.indexOf(`data-pulse-role="${role}"`));
  assert.ok(positions.every(position => position > 0));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
});

test('PULSE browser keeps a bounded last-known-good snapshot for transient API outages', () => {
  const view = text('apps/pulse/public/view-state.js');
  assert.match(view, /rinne-ops:last-known-good:v1/);
  assert.match(view, /SNAPSHOT_STORAGE_LIMIT = 1_500_000/);
  assert.match(view, /writeCachedSnapshot\(data\)/);
  assert.match(view, /if \(!snapshot\) snapshot = readCachedSnapshot\(\)/);
});

test('PULSE operator flow is presentation-compressed to four stages', () => {
  const tower = text('apps/pulse/public/control-tower.js');
  for (const id of ["work","ready","integration","dev"]) assert.match(tower, new RegExp(`id:'${id}'`));
  assert.doesNotMatch(tower, /id:'pulse'/);
  assert.match(tower, /PULSE_COPY\.recovery\.headline/);
  assert.equal(PULSE_COPY.recovery.headline, '自動復旧中');
});

test('PULSE Worker uses stable Durable Object namespace access and returns structured degraded state', () => {
  const worker = text('apps/pulse/worker.mjs');
  assert.match(worker, /namespace\.get\(namespace\.idFromName\('global'\)\)/);
  assert.match(worker, /resilientPublicState/);
  assert.match(worker, /runtimeFallback: true/);
  assert.match(worker, /refreshFailed: true/);
  assert.doesNotMatch(worker, /env\.OPS_STATE\.getByName\('global'\)/);
});
