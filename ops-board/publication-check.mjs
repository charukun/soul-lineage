import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { GAME_NAMES, GAME_ENVIRONMENTS, BOARD_NAME } from '../scripts/application-catalog.mjs';

export function assertVersion(version, expected, label = 'publication') {
  assert.match(expected || '', /^[a-f0-9]{40}$/, 'Expected exact Git commit SHA');
  assert.equal(version?.app, 'ops-board', `${label}: wrong application`);
  assert.equal(version.commit, expected, `${label}: different deployed source`);
}
export function assertSnapshot(state, expected) {
  assert.equal(state?.repository, 'charukun/soul-lineage');
  assert.equal(state.schemaVersion, 2, 'Old Worker/snapshot must not pass the new release check');
  assert.equal(state.buildCommit, expected, 'Worker revision changed after publication');
  assert.equal(state.syncStatus, 'ok', `GitHub snapshot is not fresh: ${state.syncError || state.syncStatus}`);
  assert.ok(Number.isFinite(Date.parse(state.generatedAt)), 'Missing GitHub retrieval timestamp');
  assert.ok(Date.now() - Date.parse(state.generatedAt) < 10 * 60000, 'Snapshot is stale');
  for (const list of [state.environments, state.applications, state.pullRequests?.normal, state.pullRequests?.visualReview]) assert.ok(Array.isArray(list));
  const lookup = state.pullRequests.targetLookup;
  assert.ok(lookup && ['ready', 'pending', 'unavailable'].every(key => Number.isInteger(lookup[key]) && lookup[key] >= 0), 'Target lookup metadata is missing');
  const pulls = [...state.pullRequests.normal, ...state.pullRequests.visualReview];
  assert.equal(lookup.ready + lookup.pending + lookup.unavailable, pulls.length, 'Incomplete target accounting');
  for (const [id, name] of Object.entries({ ...GAME_NAMES, portal: 'WAYFINDER', 'ops-board': BOARD_NAME })) {
    const app = state.applications.find(item => item.id === id);
    assert.equal(app?.name, name, `${id} current name`);
    if (app.kind === 'game') assert.deepEqual(app.targets.map(target => target.environment), GAME_ENVIRONMENTS.map(env => env.id));
  }
  const visual = state.applications.find(app => app.id === 'visual-review');
  if (visual) assert.equal(visual.name, 'Visual Review Lab');
  assert.deepEqual(state.environments.filter(env => env.kind === 'pages').map(env => env.id), ['dev', 'staging', 'prod']);
  return state;
}
async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${new URL(url).pathname}: HTTP ${response.status}`);
  return response.json();
}
export async function waitForPublication(base, expected) {
  let last;
  // Bounded CDN/Worker propagation check, not CI or Integration polling.
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const [assets, worker] = await Promise.all(['version.json', 'api/version'].map(path => fetchJson(new URL(`${path}?verify=${expected}`, base))));
      assertVersion(assets, expected, 'Static Assets'); assertVersion(worker, expected, 'Worker');
      console.log(`PUBLICATION_SOURCE_VERIFIED ${expected}`); return;
    } catch (error) { last = error; if (attempt < 14) await new Promise(resolve => setTimeout(resolve, 2000)); }
  }
  throw last;
}
export async function verifyPublicSnapshot(base, expected) {
  const state = await fetchJson(new URL('api/state', base));
  const out = process.env.OPS_REPORT_DIR || 'ops-review-results/public';
  await mkdir(out, { recursive: true });
  // Only the deliberately public API response is recorded. Request credentials are never written.
  await writeFile(`${out}/state.json`, JSON.stringify(state, null, 2));
  assertSnapshot(state, expected);
  console.log('PULSE_PUBLIC_VERIFIED', JSON.stringify({ commit: expected, generatedAt: state.generatedAt, targetLookup: state.pullRequests.targetLookup,
    applications: state.applications.map(({ id, name, targets }) => ({ id, name, environments: targets.map(t => t.environment) })) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.env.OPS_URL || 'https://rinne-ops.c-okamoto.workers.dev/';
  if (process.argv[2] === 'version') await waitForPublication(base, (process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA));
  else await verifyPublicSnapshot(base, (process.env.OPS_SOURCE_SHA || process.env.GITHUB_SHA));
}
