import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplications, probeFastDevVersions } from '../ops-board/applications.mjs';
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
    assert.deepEqual(targets.map(t => t.label), ['高速DEV', '検証', '本番']);
    assert.equal(targets[0].state, 'unknown');
    assert.match(targets[0].url, /^https:\/\/soul-lineage-[a-z0-9-]+-dev\.c-okamoto\.workers\.dev\/$/);
    assert.ok(targets.slice(1).every(t => t.state === 'missing' && t.url === null && t.commit === null));
  }
});
test('retired Pages DEV metadata cannot override the canonical Worker DEV target', () => {
  const app = games({ entries: [entry('demon', 'dev', 'old-sha')] }).find(app => app.id === 'demon');
  assert.equal(app.name, '喰滅廻遊');
  assert.equal(target(app, 'dev').commit, null);
  assert.equal(target(app, 'dev').state, 'unknown');
  assert.equal(target(app, 'dev').url, 'https://soul-lineage-demon-dev.c-okamoto.workers.dev/');
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
test('legacy Pages DEV entries never become active DEV links', () => {
  for (const entries of [[entry('demon', 'dev'), entry('demon', 'dev')],
    [{ ...entry('demon', 'dev'), path: 'prod/demon' }],
    [{ ...entry('demon', 'dev'), path: '//outside.invalid' }]]) {
    const dev = target(games({ entries }).find(a => a.id === 'demon'), 'dev');
    assert.equal(dev.state, 'unknown');
    assert.equal(dev.url, 'https://soul-lineage-demon-dev.c-okamoto.workers.dev/');
  }
});

test('unaffected DEV apps stay healthy from their live version when current develop has no app status', () => {
  const deployed = 'a'.repeat(40);
  const current = 'b'.repeat(40);
  const apps = buildApplications({}, [], [], {
    developSha: current,
    statuses: [],
    liveVersions: [{ app:'demon', state:'success', commit:deployed, deployedAt:'2026-09-21T00:00:00Z' }],
  });
  const dev = target(apps.find(app => app.id === 'demon'), 'dev');
  assert.equal(dev.state, 'success');
  assert.equal(dev.commit, deployed);
  assert.equal(dev.updateState, null);
  assert.match(dev.note, /DEV実体を直接確認済み/);
});

test('current per-app pending or failure status overrides an older healthy live baseline', () => {
  const live = [{ app:'demon', state:'success', commit:'a'.repeat(40), deployedAt:'2026-09-21T00:00:00Z' }];
  for (const [statusState, expected] of [['pending','deploying'],['failure','failed']]) {
    const apps = buildApplications({}, [], [], {
      developSha:'b'.repeat(40),
      statuses:[{ context:'dev/demon', state:statusState, updated_at:'2026-09-21T00:01:00Z' }],
      liveVersions:live,
    });
    assert.equal(target(apps.find(app => app.id === 'demon'), 'dev').state, expected);
  }
});

test('live DEV probe validates each version independently so one broken app cannot zero the board', async () => {
  const sha = 'c'.repeat(40);
  const rows = await probeFastDevVersions({
    timeoutMs: 1000,
    fetchImpl: async input => {
      const url = new URL(input);
      const host = url.hostname;
      const app = host === 'rinne-ops.c-okamoto.workers.dev'
        ? 'pulse'
        : host.replace(/^soul-lineage-/, '').replace(/-dev\.c-okamoto\.workers\.dev$/, '');
      if (app === 'review') return { ok:false, status:503, async json(){ return {}; } };
      return {
        ok:true, status:200,
        async json(){ return { app, environment:'dev', commit:sha, builtAt:'2026-09-21T00:02:00Z' }; },
      };
    },
  });
  assert.equal(rows.length, 7);
  assert.equal(rows.find(row => row.app === 'review').state, 'unknown');
  assert.equal(rows.filter(row => row.state === 'success').length, 6);
  assert.equal(rows.find(row => row.app === 'pulse').commit, sha);
});

test('unregistered manifest entries never silently become managed PULSE apps', () => {
  const apps = buildApplications({ entries: [entry('future-game', 'dev')] });
  assert.equal(apps.some(app => app.id === 'future-game'), false);
  assert.equal(apps.filter(app => ['game','tool','reference','control'].includes(app.kind)).length, 7);
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
  assert.deepEqual(
    apps.filter(a => ['game','tool','reference','control'].includes(a.kind)).map(a => a.id),
    ['rinne','village','demon','character-studio','visual-review','eclipse','ops-board'],
  );
  const eclipse = apps.find(a => a.id === 'eclipse');
  assert.equal(eclipse.name, 'ECLIPSE 黎明の残響');
  assert.equal(eclipse.kind, 'reference');
  assert.deepEqual(eclipse.targets.map(target => target.environment), ['dev']);
  assert.equal(eclipse.targets[0].url, 'https://soul-lineage-eclipse-dev.c-okamoto.workers.dev/');
});
