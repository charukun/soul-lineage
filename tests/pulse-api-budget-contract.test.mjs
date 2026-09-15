import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE uses event refresh plus a bounded 30-minute reconciliation cron', () => {
  const wrangler = text('wrangler.ops.jsonc');
  const worker = text('ops-board/worker.mjs');
  const integration = text('.github/workflows/integration-controller.yml');
  assert.match(wrangler, /"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.doesNotMatch(wrangler, /"\*\/5 \* \* \* \*"/);
  assert.match(worker, /x-ops-refresh-reason/);
  assert.match(integration, /Refresh PULSE from this existing Integration runner/);
  assert.match(integration, /x-ops-refresh-reason: integration/);
  assert.match(integration, /continue-on-error: true/);
});

test('PULSE bounds API work and records request-budget observability', () => {
  const client = text('ops-board/github-client.mjs');
  const collector = text('ops-board/collector.mjs');
  const snapshot = text('ops-board/pull-snapshot.mjs');
  const review = text('ops-board/review-model.mjs');
  assert.match(client, /public: 18/);
  assert.match(client, /authenticated: 32/);
  assert.match(client, /maxAgeMs/);
  assert.match(client, /deepAllowed/);
  assert.match(collector, /syncPullSnapshot/);
  assert.match(collector, /githubApi: \{/);
  assert.match(collector, /pullSync: \{/);
  assert.match(snapshot, /FULL_PULL_RECONCILE_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(review, /MAX_TARGET_FILE_PAGES = 5/);
});

test('deployment prime cannot amplify target enrichment into twelve refreshes', () => {
  const prime = text('ops-board/prime.mjs');
  assert.match(prime, /batch < 3/);
  assert.doesNotMatch(prime, /batch < 12/);
  assert.match(prime, /'x-ops-refresh-reason': 'prime'/);
});
