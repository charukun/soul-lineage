// Prime attribution once with this Actions job's read token.
// No CI polling, PR mutation, persistent copy of the job credential, or refresh amplification.
import { setTimeout as delay } from 'node:timers/promises';
import { assertSnapshot } from './publication-check.mjs';
const url = process.env.OPS_URL || 'https://rinne-ops.c-okamoto.workers.dev/';
const refreshToken = process.env.OPS_REFRESH_TOKEN;
const githubToken = process.env.GH_TOKEN;
if (!refreshToken || !githubToken) throw new Error('Required server-side refresh credentials are missing');
const maxRefreshAttempts = 3;
const transientStatus = status => status === 429 || status >= 500;
const retryDelayMs = (response, attempt) => {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  return Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.min(retryAfter * 1000, 10_000) : 500 * (2 ** (attempt - 1));
};
async function refreshOnce() {
  let lastError;
  for (let attempt = 1; attempt <= maxRefreshAttempts; attempt++) {
    let response;
    try {
      response = await fetch(new URL('api/refresh', url), { method: 'POST', headers: { authorization: `Bearer ${refreshToken}`, 'x-ops-github-token': githubToken, 'x-ops-refresh-reason': 'prime' }, signal: AbortSignal.timeout(120000) });
    } catch (error) {
      lastError = error;
      if (attempt === maxRefreshAttempts) throw error;
      const waitMs = retryDelayMs(null, attempt);
      console.log(`::warning::Ops refresh transport failure; retry ${attempt}/${maxRefreshAttempts} in ${waitMs}ms: ${error.message}`);
      await delay(waitMs);
      continue;
    }
    if (response.ok) return response;
    if (!transientStatus(response.status) || attempt === maxRefreshAttempts) throw new Error(`Ops refresh HTTP ${response.status}`);
    const waitMs = retryDelayMs(response, attempt);
    console.log(`::warning::Ops refresh HTTP ${response.status}; retry ${attempt}/${maxRefreshAttempts} in ${waitMs}ms`);
    await delay(waitMs);
  }
  throw lastError || new Error('Ops refresh failed without a response');
}

const response = await refreshOnce();
const state = assertSnapshot(await response.json(), (process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA));
const lookup = state.pullRequests.targetLookup;
console.log(`Target prime: ready=${lookup.ready}, pending=${lookup.pending}, unavailable=${lookup.unavailable}, api=${state.githubApi?.requests ?? '?'} requests`);
if (lookup.pending || lookup.unavailable) {
  console.log('::warning::Some PR target attribution remains explicitly pending or unavailable; later authenticated event/reconcile refreshes will continue it.');
}
