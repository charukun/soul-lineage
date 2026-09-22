import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_URL = 'https://rinne-ops.c-okamoto.workers.dev/';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_STATE_AGE_MS = 10 * 60_000;
export const PULSE_REFRESH_REASONS = new Set(['prime', 'pr-event', 'integration', 'deployment']);

function requiredCredential(value, name) {
  const credential = typeof value === 'string' ? value.trim() : '';
  if (credential) return credential;
  const error = new Error(`PULSE refresh requires ${name}`);
  error.code = 'PULSE_REFRESH_CREDENTIAL_REQUIRED';
  throw error;
}

function retryDelayMs(response, attempt, nowMs) {
  const raw = response?.headers?.get?.('retry-after');
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
    const at = Date.parse(raw);
    if (Number.isFinite(at) && at > nowMs) return Math.min(at - nowMs, 10_000);
  }
  return Math.min(500 * (2 ** Math.max(0, attempt - 1)), 4_000);
}

const transientStatus = status => status === 429 || status >= 500;

export function assertAuthenticatedRefreshState(state, {
  expectedBuildCommit = null,
  now = Date.now(),
  maxStateAgeMs = DEFAULT_MAX_STATE_AGE_MS,
} = {}) {
  assert.equal(state?.repository, 'charukun/soul-lineage', 'PULSE refresh returned the wrong repository');
  assert.equal(state?.schemaVersion, 2, 'PULSE refresh returned an unsupported schema');
  assert.equal(state?.syncStatus, 'ok', `PULSE refresh is degraded: ${state?.syncError || state?.syncStatus || 'unknown'}`);
  assert.equal(state?.githubApi?.scope, 'authenticated', 'PULSE refresh did not use authenticated GitHub access');
  const generatedAt = Date.parse(state?.generatedAt || '');
  assert.ok(Number.isFinite(generatedAt), 'PULSE refresh response has no valid generatedAt');
  const age = now - generatedAt;
  assert.ok(age >= -60_000 && age < maxStateAgeMs, `PULSE refresh response is stale (${age}ms)`);
  if (expectedBuildCommit) {
    assert.match(expectedBuildCommit, /^[0-9a-f]{40}$/, 'Expected PULSE build SHA must be exact');
    assert.equal(state?.buildCommit, expectedBuildCommit, 'PULSE Worker source does not match the expected build');
  }
  return state;
}

export async function refreshPulseState({
  baseUrl = DEFAULT_URL,
  refreshToken,
  githubToken,
  reason = 'deployment',
  expectedBuildCommit = null,
  fetchImpl = fetch,
  now = Date.now,
  sleep = delay,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  captureState = null,
} = {}) {
  const serverCredential = requiredCredential(refreshToken, 'OPS_REFRESH_TOKEN');
  const githubCredential = requiredCredential(githubToken, 'GH_TOKEN');
  if (!PULSE_REFRESH_REASONS.has(reason)) throw new Error(`Unsupported PULSE refresh reason: ${reason}`);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error('PULSE refresh maxAttempts must be between 1 and 5');
  const nowFn = typeof now === 'function' ? now : () => now;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(new URL('api/refresh', baseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serverCredential}`,
          'x-ops-github-token': githubCredential,
          'x-ops-refresh-reason': reason,
        },
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
      const waitMs = retryDelayMs(null, attempt, nowFn());
      console.log(`::warning::PULSE refresh transport failure; retry ${attempt}/${maxAttempts} in ${waitMs}ms: ${error.message}`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.clone().json();
        detail = String(body?.error || body?.message || '').slice(0, 120);
      } catch { /* status is still actionable */ }
      const error = new Error(`PULSE refresh HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      error.status = response.status;
      lastError = error;
      if (!transientStatus(response.status) || attempt === maxAttempts) throw error;
      const waitMs = retryDelayMs(response, attempt, nowFn());
      console.log(`::warning::PULSE refresh HTTP ${response.status}${detail ? ` (${detail})` : ''}; retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }

    let state;
    try {
      state = await response.json();
    } catch (error) {
      throw new Error(`PULSE refresh returned invalid JSON: ${error.message}`);
    }
    if (typeof captureState === 'function') captureState(state);
    return assertAuthenticatedRefreshState(state, { expectedBuildCommit, now: nowFn() });
  }

  throw lastError || new Error('PULSE refresh failed without a response');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const state = await refreshPulseState({
    baseUrl: process.env.OPS_URL || DEFAULT_URL,
    refreshToken: process.env.OPS_REFRESH_TOKEN,
    githubToken: process.env.GH_TOKEN,
    reason: process.env.OPS_REFRESH_REASON || 'deployment',
    expectedBuildCommit: process.env.OPS_EXPECTED_BUILD_SHA || null,
    captureState: value => {
      if (process.env.PULSE_STATE_OUTPUT) writeFileSync(process.env.PULSE_STATE_OUTPUT, JSON.stringify(value));
    },
  });
  console.log(`PULSE_REFRESH_OK reason=${process.env.OPS_REFRESH_REASON || 'deployment'} generatedAt=${state.generatedAt} api=${state.githubApi?.requests ?? '?'} cacheHits=${state.githubApi?.cacheHits ?? 0} control=${state.controlTower?.status || 'legacy'}`);
}
