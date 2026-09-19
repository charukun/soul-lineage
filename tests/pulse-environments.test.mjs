import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplications } from '../apps/pulse/applications.mjs';
import { GAME_ENVIRONMENTS, INITIAL_ENVIRONMENT_APPS } from '../scripts/application-catalog.mjs';
import { missingEnvironmentEntries, retainPinnedEntries } from '../scripts/environment-plan.mjs';

const entry = (app, environment, commit = 'published') => ({ app, environment, path: `${environment}/${app}`, legacy: false, version: { commit, name: 'old title' } });
const games = manifest => buildApplications(manifest).filter(app => app.kind === 'game');
const target = (app, environment) => app.targets.find(item => item.environment === environment);
const releaseTargets = app => ['dev', 'staging', 'prod'].map(environment => target(app, environment));

test('every current game remains visible with development, staging and production, including absent entries', () => {
  const apps = games({ entries: [] });
  assert.equal(apps.length, 3);
  for (const app of apps) {
    const targets = releaseTargets(app);
    assert.deepEqual(targets.map(t => t.environment), ['dev', 'staging', 'prod']);
    assert.deepEqual(targets.map(t => t.label), ['開発', '検証', '本番']);
    assert.ok(targets.every(t => t.state === 'missing' && t.url === null && t.commit === null));
  }
});
test('the current metadata wins over an old deployed title, without changing its deployed SHA', () => {
  const app = games({ entries: [entry('demon', 'dev', 'old-sha')] }).find(app => app.id === 'demon');
  assert.equal(app.name, '尽喰廻遊');
  assert.equal(target(app, 'dev').commit, 'old-sha');
  assert.equal(target(app, 'dev').publishedName, 'old title');
});
test('staging URL and deployment date are independent from dev/prod', () => {
  const staging = { ...entry('demon', 'staging', 'staged'), deployedAt: '2026-09-12T09:00:00Z' };
  const app = games({ entries: [entry('demon', 'dev'), staging] }).find(a => a.id === 'demon');
  assert.equal(target(app, 'staging').url, 'https://charukun.github.io/soul-lineage/staging/demon/');
  assert.equal(target(app, 'staging').commit, 'staged');
  assert.equal(target(app, 'staging').deployedAt, staging.deployedAt);
  assert.equal(target(app, 'prod').state, 'missing');
});
test('legacy production path remains the exact published route', () => {
  const app = games({ entries: [{ ...entry('rinne', 'prod'), path: 'prod', legacy: true }] }).find(a => a.id === 'rinne');
  assert.equal(target(app, 'prod').url, 'https://charukun.github.io/soul-lineage/prod/');
});
test('ambiguous, cross-environment and external paths never become active links', () => {
  for (const entries of [[entry('demon', 'dev'), entry('demon', 'dev')],
    [{ ...entry('demon', 'dev'), path: 'prod/demon' }],
    [{ ...entry('demon', 'dev'), path: '//outside.invalid' }],
    [{ ...entry('demon', 'dev'), version: {} }]]) {
    const dev = target(games({ entries }).find(a => a.id === 'demon'), 'dev');
    assert.equal(dev.state, 'unknown');
    assert.equal(dev.url, null);
  }
});
test('new manifest games also receive the same three-environment matrix', () => {
  const app = games({ entries: [entry('future-game', 'dev')] }).find(a => a.id === 'future-game');
  assert.equal(releaseTargets(app).length, 3);
  assert.equal(target(app, 'staging').state, 'missing');
  assert.equal(target(app, 'prod').state, 'missing');
});
test('only the requested game set is authorized for missing-environment initialization', () => {
  const previous = [{ ...entry('rinne', 'prod', 'legacy'), path: 'prod', files: [{ path: 'index.html' }] }];
  const candidates = ['rinne', 'village', 'demon', 'future-game'].flatMap(app => GAME_ENVIRONMENTS.map(env => entry(app, env.id)));
  const additions = missingEnvironmentEntries(candidates, previous, INITIAL_ENVIRONMENT_APPS);
  assert.equal(additions.length, 5);
  assert.ok(additions.every(e => e.pinned && e.branch === 'develop'));
  assert.ok(!additions.some(e => e.app === 'future-game' || e.environment === 'dev' || e.app === 'rinne' && e.environment === 'prod'));
  assert.equal(missingEnvironmentEntries(candidates, [...previous, ...additions], INITIAL_ENVIRONMENT_APPS).length, 0);
});
test('initialization rejects published-byte collisions and duplicate target definitions', () => {
  const candidate = entry('demon', 'prod');
  const prior = [{ ...entry('rinne', 'prod'), path: 'prod', files: [{ path: 'demon/index.html' }] }];
  assert.throws(() => missingEnvironmentEntries([candidate], prior, ['demon']), /overwrite/);
  assert.throws(() => missingEnvironmentEntries([candidate, candidate], [], ['demon']), /Duplicate/);
});
test('pinned staging and supplemental production survive ordinary deployment plans', () => {
  const pinned = [{ ...entry('demon', 'staging', 'staged'), pinned: true }, { ...entry('demon', 'prod', 'release'), pinned: true }];
  const desired = [entry('demon', 'dev', 'new')];
  assert.deepEqual(retainPinnedEntries(desired, pinned), [...desired, ...pinned]);
  const promoted = entry('demon', 'prod', 'main-promoted');
  const result = retainPinnedEntries([...desired, promoted], pinned);
  assert.equal(result.filter(e => e.environment === 'prod').length, 1);
  assert.equal(result.find(e => e.environment === 'prod').version.commit, 'main-promoted');
});
test('tool display names do not leak explanatory parentheses or the retired board name', () => {
  const apps = buildApplications({}, [{ id: 'visual-review', kind: 'preview' }]);
  assert.equal(apps.find(a => a.id === 'visual-review').name, 'Visual Review Lab');
  assert.equal(apps.find(a => a.id === 'portal').name, 'WAYFINDER');
  assert.equal(apps.find(a => a.id === 'ops-board').name, 'PULSE');
});
