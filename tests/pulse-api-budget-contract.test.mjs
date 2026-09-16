import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE keeps 30-minute reconciliation but never uses tokenless GitHub access', () => {
  const wrangler = text('wrangler.ops.jsonc');
  const worker = text('ops-board/worker.mjs');
  const integration = text('.github/workflows/integration-controller.yml');
  assert.match(wrangler, /"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.doesNotMatch(wrangler, /"\*\/5 \* \* \* \*"/);
  assert.match(worker, /x-ops-refresh-reason/);
  assert.match(worker, /if \(!token\) throw githubAuthError\(source\)/);
  assert.match(worker, /if \(!env\.OPS_GITHUB_TOKEN\) return;/);
  assert.match(worker, /if \(!state && env\.OPS_GITHUB_TOKEN\) state = await stub\.refresh\('cold-start'\)/);
  assert.match(worker, /if \(!state\) return json\(\{ error: 'github_auth_required' \}, 503\)/);
  assert.match(worker, /if \(!token && !env\.OPS_GITHUB_TOKEN\) return json\(\{ error: 'github_auth_required' \}, 503\)/);
  assert.doesNotMatch(worker, /shouldReuseFreshState/);
  assert.match(integration, /Fallback refresh PULSE if publication wake failed/);
  assert.match(integration, /steps\.publication\.outcome == 'failure'/);
  assert.doesNotMatch(integration, /Refresh PULSE from this existing Integration runner/);
});

test('PULSE GitHub client requires authentication and records request-budget observability', () => {
  const client = text('ops-board/github-client.mjs');
  const collector = text('ops-board/collector.mjs');
  const snapshot = text('ops-board/pull-snapshot.mjs');
  const review = text('ops-board/review-model.mjs');
  assert.match(client, /const REQUEST_CAP = 32/);
  assert.doesNotMatch(client, /public:\s*\d+/);
  assert.match(client, /kind: 'auth-required'/);
  assert.match(client, /未認証APIへは接続しません/);
  assert.match(client, /authorization: `Bearer \$\{credential\}`/);
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
  assert.match(collector, /pullSync: \{/);
  assert.match(snapshot, /FULL_PULL_RECONCILE_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(review, /MAX_TARGET_FILE_PAGES = 5/);
});

test('deployment prime performs one authenticated refresh and leaves remaining attribution to later events', () => {
  const prime = text('ops-board/prime.mjs');
  assert.match(prime, /const response = await refreshOnce\(\)/);
  assert.doesNotMatch(prime, /for \(let batch/);
  assert.match(prime, /later authenticated event\/reconcile refreshes will continue it/);
  assert.match(prime, /'x-ops-refresh-reason': 'prime'/);
  assert.match(prime, /githubToken/);
});
