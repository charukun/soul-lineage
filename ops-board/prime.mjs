// Prime target attribution in bounded batches using this Actions job's read token.
// This does not poll CI, mutate PRs, or persist the job credential in the Worker.
const url = process.env.OPS_URL || 'https://rinne-ops.c-okamoto.workers.dev/';
const refreshToken = process.env.OPS_REFRESH_TOKEN;
const githubToken = process.env.GH_TOKEN;
if (!refreshToken || !githubToken) throw new Error('Required server-side refresh credentials are missing');
let previousReady = -1;
for (let batch = 0; batch < 12; batch++) {
  const response = await fetch(new URL('api/refresh', url), { method: 'POST', headers: { authorization: `Bearer ${refreshToken}`, 'x-ops-github-token': githubToken }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Ops refresh HTTP ${response.status}`);
  const state = await response.json();
  if (state.syncStatus !== 'ok') throw new Error(`Ops snapshot not fresh: ${state.syncError || state.syncStatus}`);
  const lookup = state.pullRequests?.targetLookup || {};
  console.log(`Target batch ${batch + 1}: ready=${lookup.ready ?? 0}, pending=${lookup.pending ?? 0}, unavailable=${lookup.unavailable ?? 0}`);
  if (!lookup.pending || lookup.ready === previousReady) break;
  previousReady = lookup.ready;
}
