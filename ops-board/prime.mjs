// Prime attribution in bounded batches with this Actions job's read token.
// No CI polling, PR mutation, or persistent copy of the job credential.
import { assertSnapshot } from './publication-check.mjs';
const url = process.env.OPS_URL || 'https://rinne-ops.c-okamoto.workers.dev/';
const refreshToken = process.env.OPS_REFRESH_TOKEN;
const githubToken = process.env.GH_TOKEN;
if (!refreshToken || !githubToken) throw new Error('Required server-side refresh credentials are missing');
let previousReady = -1;
for (let batch = 0; batch < 12; batch++) {
  const response = await fetch(new URL('api/refresh', url), { method: 'POST', headers: { authorization: `Bearer ${refreshToken}`, 'x-ops-github-token': githubToken }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Ops refresh HTTP ${response.status}`);
  const state = assertSnapshot(await response.json(), process.env.GITHUB_SHA);
  const lookup = state.pullRequests.targetLookup;
  console.log(`Target batch ${batch + 1}: ready=${lookup.ready}, pending=${lookup.pending}, unavailable=${lookup.unavailable}`);
  if (!lookup.pending || lookup.ready === previousReady) {
    if (lookup.pending || lookup.unavailable) console.log('::warning::Some PR target attribution remains explicitly pending or unavailable; the board does not invent results.');
    break;
  }
  previousReady = lookup.ready;
}
