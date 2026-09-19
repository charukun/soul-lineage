import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE keeps 30-minute reconciliation but never uses tokenless GitHub access', () => {
  const wrangler = text('wrangler.ops.jsonc');
  const worker = text('ops-board/worker.mjs');
  const dev = text('.github/workflows/dev-app-publish.yml');
  const notify = text('scripts/notify-fast-dev.mjs');
  const pulseConfig = text('wrangler.dev.pulse.jsonc');
  assert.match(wrangler, /"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.doesNotMatch(wrangler, /"\*\/5 \* \* \* \*"/);
  assert.match(worker, /x-ops-refresh-reason/);
  assert.match(worker, /if \(!token\) throw githubAuthError\(source\)/);
  assert.match(worker, /if \(!env\.OPS_GITHUB_TOKEN\) return;/);
  assert.match(worker, /if \(!state && env\.OPS_GITHUB_TOKEN\) state = await stub\.refresh\('cold-start'\)/);
  assert.match(worker, /resilientPublicState/);
  assert.match(worker, /createMemoryStorage/);
  assert.match(worker, /this\.refreshStorage = createMemoryStorage\(\)/);
  assert.match(worker, /buildState\(previous, \{ storage: this\.refreshStorage/);
  assert.match(worker, /previous = this\.memoryState/);
  assert.match(worker, /async getState\(\) \{\s*return this\.memoryState;/);
  assert.match(worker, /peer persistence must not poison PULSE state/);
  assert.doesNotMatch(worker, /writeStored\(this\.ctx\.storage, STATE_KEY, state\)/);
  assert.doesNotMatch(worker, /readStored\(this\.ctx\.storage, STATE_KEY\)/);
  assert.match(worker, /namespace\.idFromName\('global'\)/);
  assert.match(worker, /namespace\.get\(namespace\.idFromName\('global'\)\)/);
  assert.match(worker, /if \(!token && !env\.OPS_GITHUB_TOKEN\) return json\(\{ error: 'github_auth_required' \}, 503\)/);
  assert.doesNotMatch(worker, /shouldReuseFreshState/);
  assert.doesNotMatch(dev, /ops-board\.yml|pulse-refresh\.yml/);
  assert.match(notify, /refreshPulseState/);
  assert.match(notify, /refreshToken:token,githubToken:token/);
  assert.match(worker, /authorizedRefresh/);
  assert.match(worker, /auth===github/);
  assert.match(pulseConfig, /"keep_vars": true/);
  assert.match(pulseConfig, /"crons": \["\*\/30 \* \* \* \*"\]/);
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
  assert.equal((prime.match(/refreshPulseState\s*\(\{/g) || []).length, 1);
  assert.doesNotMatch(prime, /for \(let batch/);
  assert.match(prime, /later authenticated event\/reconcile refreshes will continue it/);
  assert.match(prime, /reason: 'prime'/);
  assert.match(prime, /githubToken: process\.env\.GH_TOKEN/);
  assert.match(prime, /refreshToken: process\.env\.OPS_REFRESH_TOKEN/);
  assert.doesNotMatch(prime, /fetch\(|\bcurl\b|api\/refresh/);
});