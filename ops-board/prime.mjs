// Prime attribution once with this Actions job's read token.
// The shared refresh client owns authentication, bounded retry, and response validation.
import { refreshPulseState } from './refresh-client.mjs';

const state = await refreshPulseState({
  baseUrl: process.env.OPS_URL || 'https://rinne-ops.c-okamoto.workers.dev/',
  refreshToken: process.env.OPS_REFRESH_TOKEN,
  githubToken: process.env.GH_TOKEN,
  reason: 'prime',
  expectedBuildCommit: process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA,
});

const lookup = state.pullRequests.targetLookup;
console.log(`Target prime: ready=${lookup.ready}, pending=${lookup.pending}, unavailable=${lookup.unavailable}, api=${state.githubApi?.requests ?? '?'} requests`);
if (lookup.pending || lookup.unavailable) {
  console.log('::warning::Some PR target attribution remains explicitly pending or unavailable; later authenticated event/reconcile refreshes will continue it.');
}
