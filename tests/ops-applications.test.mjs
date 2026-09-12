import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplications, OPS_PUBLIC_URL, PORTAL_PUBLIC_URL } from '../ops-board/applications.mjs';

test('published apps are grouped by app with exact manifest paths', () => {
  const manifest = { entries: [
    { app: 'rinne', environment: 'dev', path: 'dev/rinne', version: { name: '輪廻転焦', commit: 'dev-rinne' } },
    { app: 'rinne', environment: 'prod', path: 'prod', version: { name: '輪廻転焦', commit: 'prod-rinne' } },
    { app: 'village', environment: 'dev', path: 'dev/village', version: { name: 'MURAAAAAAA', commit: 'dev-village' } },
  ] };
  const environments = [
    { id: 'dev', deployState: 'success', deployedAt: '2026-09-12T00:00:00Z' },
    { id: 'prod', deployState: 'success', deployedAt: '2026-09-11T00:00:00Z' },
  ];
  const apps = buildApplications(manifest, environments, []);
  const rinne = apps.find(app => app.id === 'rinne');
  assert.equal(rinne.targets.length, 2);
  assert.equal(rinne.targets[0].url, 'https://charukun.github.io/soul-lineage/dev/rinne/');
  assert.equal(rinne.targets[0].commit, 'dev-rinne');
  assert.equal(rinne.targets[1].url, 'https://charukun.github.io/soul-lineage/prod/');
});

test('tools use verified public status while failed Lanternfell never invents a URL', () => {
  const environments = [{
    id: 'visual-review', kind: 'preview', name: 'Visual Review', deployState: 'success',
    url: 'https://rinne-visual-review.example.workers.dev/', deployedCommit: 'vrm', deployedAt: '2026-09-12T00:00:00Z',
  }];
  const runs = [
    { name: 'Rinne Public Portal', status: 'completed', conclusion: 'success', head_sha: 'portal', updated_at: '2026-09-12T00:00:30Z' },
    { name: 'Rinne Ops Board', status: 'completed', conclusion: 'success', head_sha: 'ops', updated_at: '2026-09-12T00:01:00Z' },
    { name: 'Lanternfell night portrait DEV', status: 'completed', conclusion: 'failure', head_sha: 'lantern', updated_at: '2026-09-12T00:02:00Z' },
  ];
  const apps = buildApplications({ entries: [] }, environments, runs);
  const visual = apps.find(app => app.id === 'visual-review');
  const portal = apps.find(app => app.id === 'portal');
  const ops = apps.find(app => app.id === 'ops-board');
  const lantern = apps.find(app => app.id === 'lanternfell');
  assert.equal(visual.targets[0].url, environments[0].url);
  assert.equal(portal.targets[0].url, PORTAL_PUBLIC_URL);
  assert.equal(portal.targets[0].state, 'success');
  assert.equal(ops.targets[0].url, OPS_PUBLIC_URL);
  assert.equal(lantern.targets[0].state, 'failed');
  assert.equal(lantern.targets[0].url, null);
  assert.match(lantern.targets[0].note, /表示しません/);
});
