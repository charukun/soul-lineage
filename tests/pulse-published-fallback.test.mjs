import test from 'node:test';
import assert from 'node:assert/strict';
import { publishedFallback } from '../ops-board/published-fallback.mjs';
const options = { now: '2026-09-12T10:00:00Z', source: 'test', error: new Error('GitHub /branches: HTTP 403') };
const published = (environment, commit) => ({ app: 'demon', environment, path: `${environment}/demon`, version: { commit, name: '暗い喰らいCry' } });

test('GitHub 403 cannot retain retired names or the old two-environment matrix', () => {
  const old = { generatedAt: '2026-09-12T09:00:00Z', applications: [{ id: 'demon', name: '暗い喰らいCry', kind: 'game', targets: [] }] };
  const state = publishedFallback(old, { schemaVersion: 1, entries: [published('dev', 'actual')] }, options);
  const game = state.applications.find(app => app.id === 'demon');
  assert.equal(game.name, '尽喰廻遊');
  assert.deepEqual(game.targets.map(target => target.environment), ['dev', 'staging', 'prod']);
  assert.equal(game.targets[0].commit, 'actual');
  assert.equal(game.targets[1].state, 'missing');
  assert.equal(game.targets[1].url, null);
  assert.equal(state.generatedAt, old.generatedAt);
  assert.equal(state.applicationsUpdatedAt, options.now);
  assert.equal(state.syncStatus, 'degraded');
  assert.match(state.syncError, /403/);
});

test('fresh public staging metadata invalidates stale reflected-PR history', () => {
  const old = { environments: [{ id: 'staging', deployedCommit: 'old', reflectedPrs: [{ number: 1 }], reflectedPrCount: 1, historyComplete: true }] };
  const state = publishedFallback(old, { schemaVersion: 1, entries: [published('staging', 'new')] }, options);
  const staging = state.environments.find(env => env.id === 'staging');
  assert.equal(staging.deployedCommit, 'new');
  assert.equal(staging.branchCommit, null);
  assert.equal(staging.historyComplete, false);
  assert.deepEqual(staging.reflectedPrs, []);
  assert.equal(staging.reflectedPrCount, null);
});

test('cached tool URLs survive but their old names and freshness claims do not', () => {
  const old = {
    environments: [{ id: 'visual-review', kind: 'preview', url: 'https://rinne-visual-review.c-okamoto.workers.dev/' }],
    applications: [
      { id: 'visual-review', name: 'Visual Review Lab（見た目確認）', targets: [{ environment: 'preview', state: 'success', url: 'https://rinne-visual-review.c-okamoto.workers.dev/' }] },
      { id: 'portal', name: 'WAYFINDER（公開リンクギャラリー）', targets: [{ state: 'success', url: 'https://wayfinder-gallery.c-okamoto.workers.dev/' }] },
    ],
  };
  const state = publishedFallback(old, { schemaVersion: 1, entries: [] }, options);
  const visual = state.applications.find(app => app.id === 'visual-review');
  assert.equal(visual.name, 'Visual Review Lab');
  assert.equal(visual.targets[0].url, old.applications[0].targets[0].url);
  assert.equal(visual.targets[0].state, 'unknown');
  assert.equal(state.applications.find(app => app.id === 'portal').name, 'WAYFINDER');
  assert.equal(state.applications.find(app => app.id === 'ops-board').name, 'PULSE');
});

test('public-only cold start never invents a successful GitHub sync', () => {
  const state = publishedFallback(null, { schemaVersion: 1, entries: [published('prod', 'release')] }, options);
  assert.equal(state.generatedAt, null);
  assert.equal(state.syncStatus, 'degraded');
  assert.equal(state.applications.find(app => app.id === 'demon').targets[2].commit, 'release');
  assert.deepEqual(state.pullRequests.normal, []);
});

test('a malformed public manifest is not interpreted as all games being unpublished', () => {
  assert.throws(() => publishedFallback(null, {}, options), /Invalid public/);
  assert.throws(() => publishedFallback(null, { schemaVersion: 1 }, options), /Invalid public/);
});
