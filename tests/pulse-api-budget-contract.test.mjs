import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE uses event refresh plus a bounded 30-minute reconciliation cron', () => {
  const wrangler = text('wrangler.ops.jsonc');
  const worker = text('ops-board/worker.mjs');
  const policy = text('ops-board/refresh-policy.mjs');
  const integration = text('.github/workflows/integration-controller.yml');
  assert.match(wrangler, /"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.doesNotMatch(wrangler, /"\*\/5 \* \* \* \*"/);
  assert.match(worker, /x-ops-refresh-reason/);
  assert.match(worker, /shouldReuseFreshState/);
  assert.match(policy, /ANONYMOUS_RECONCILE_MIN_AGE_MS = 20 \* 60 \* 1000/);
  assert.match(integration, /Fallback refresh PULSE if publication wake failed/);
  assert.match(integration, /steps\.publication\.outcome == 'failure'/);
  assert.doesNotMatch(integration, /Refresh PULSE from this existing Integration runner/);
});

test('PULSE bounds API work and records request-budget observability', () => {
  const client = text('ops-board/github-client.mjs');
  const collector = text('ops-board/collector.mjs');
  const snapshot = text('ops-board/pull-snapshot.mjs');
  const review = text('ops-board/review-model.mjs');
  assert.match(client, /public: 12/);
  assert.match(client, /authenticated: 32/);
  assert.match(client, /classifyGithubFailure/);
  assert.match(client, /x-ratelimit-resource/);
  assert.match(client, /x-ratelimit-used/);
  assert.match(client, /retry-after/);
  assert.match(client, /kind: 'internal-budget'/);
  assert.match(client, /maxAgeMs/);
  assert.match(client, /deepAllowed/);
  assert.match(collector, /syncPullSnapshot/);
  assert.match(collector, /githubApi: \{/);
  assert.match(collector, /githubFailure: null/);
  assert.match(collector, /client\.scope === 'public'/);
  assert.match(collector, /client\.deepAllowed && token \? 4 : 0/);
  assert.match(collector, /pullSync: \{/);
  assert.match(snapshot, /FULL_PULL_RECONCILE_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(review, /MAX_TARGET_FILE_PAGES = 5/);
});

test('deployment prime performs one full refresh and leaves remaining attribution to later events', () => {
  const prime = text('ops-board/prime.mjs');
  assert.match(prime, /const response = await refreshOnce\(\)/);
  assert.doesNotMatch(prime, /for \(let batch/);
  assert.match(prime, /later authenticated event\/reconcile refreshes will continue it/);
  assert.match(prime, /'x-ops-refresh-reason': 'prime'/);
});
