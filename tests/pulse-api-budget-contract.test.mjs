import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE keeps authenticated event refresh primary with bounded public cold-start recovery', () => {
  const wrangler = text('wrangler.ops.jsonc');
  const worker = text('ops-board/worker.mjs');
  const client = text('ops-board/github-client.mjs');
  const collector = text('ops-board/collector.mjs');
  const notify = text('scripts/notify-fast-dev.mjs');
  assert.match(wrangler, /"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.match(worker, /recoverPublic/);
  assert.match(worker, /publicRecovery:true/);
  assert.match(worker, /cold-start-public/);
  assert.match(worker, /stub\.recoverPublic/);
  assert.match(worker, /if \(!token\) throw githubAuthError\(source\)/, 'explicit refresh remains authenticated');
  assert.match(worker, /if \(!token && !env\.OPS_GITHUB_TOKEN\) return json\(\{ error: 'github_auth_required' \}, 503\)/);
  assert.doesNotMatch(worker, /writeStored\(this\.ctx\.storage, STATE_KEY, state\)/);
  assert.match(client, /PUBLIC_REQUEST_CAP = 6/);
  assert.match(client, /allowPublic = false/);
  assert.match(client, /publicAccess/);
  assert.match(collector, /PUBLIC_RECOVERY_PULL_LIMIT = 40/);
  assert.match(collector, /mode:'public-recovery'/);
  assert.match(collector, /bounded public GitHub cold-start recovery/);
  assert.match(notify, /refreshPulseState/);
});

test('PULSE public recovery stays shallow while authenticated snapshots retain the normal budget', () => {
  const client = text('ops-board/github-client.mjs');
  const collector = text('ops-board/collector.mjs');
  assert.match(client, /const REQUEST_CAP = 32/);
  assert.match(client, /PUBLIC_REQUEST_CAP = 6/);
  assert.match(client, /scope = credential \? 'authenticated' : publicAccess \? 'public'/);
  assert.match(client, /deepAllowed/);
  assert.match(collector, /publicRecovery \? await publicRecoveryPullSnapshot/);
  assert.match(collector, /publicRecovery \? deploymentQueue\(null\)/);
  assert.match(collector, /publicRecovery \? \(previous\?\.integrationRescue \|\| rescueView\(null\)\)/);
  assert.match(collector, /githubApi: \{/);
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