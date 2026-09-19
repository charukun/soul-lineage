import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplications, OPS_PUBLIC_URL, PORTAL_PUBLIC_URL } from '../apps/pulse/applications.mjs';

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
  const apps = buildApplications(manifest, environments, [], {developSha:'develop-head',statuses:[{context:'dev/rinne',state:'success',updated_at:'2026-09-12T00:00:30Z'}]});
  const rinne = apps.find(app => app.id === 'rinne');
  assert.equal(rinne.targets.length, 4);
  assert.equal(rinne.targets[0].label, '高速DEV');
  assert.equal(rinne.targets[0].state, 'success');
  assert.equal(rinne.targets[0].url, 'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/');
  assert.equal(rinne.targets[0].commit, 'develop-head');
  assert.equal(rinne.targets[2].state, 'missing');
  assert.equal(rinne.targets[2].url, null);
  assert.equal(rinne.targets[1].url, 'https://charukun.github.io/soul-lineage/dev/rinne/');
  assert.equal(rinne.targets[1].commit, 'dev-rinne');
  assert.equal(rinne.targets[3].url, 'https://charukun.github.io/soul-lineage/prod/');
});

test('independent developer tools use their own exact fast DEV statuses', () => {
  const apps=buildApplications({entries:[]},[],[],{developSha:'head',statuses:[
    {context:'dev/character-studio',state:'success',updated_at:'2026-09-19T00:00:00Z'},
    {context:'dev/review',state:'success',updated_at:'2026-09-19T00:00:01Z'},
  ]});
  const studio=apps.find(app=>app.id==='character-studio');
  const visual=apps.find(app=>app.id==='visual-review');
  assert.equal(studio.targets[0].url,'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/');
  assert.equal(visual.targets[0].url,'https://soul-lineage-review-dev.c-okamoto.workers.dev/');
  assert.equal(studio.targets[0].commit,'head');
  assert.equal(visual.targets[0].commit,'head');
});

test('tools use verified public status while failed Lanternfell never invents a URL', () => {
  const environments = [];
  const runs = [
    { name: 'Wayfinder Public Gallery', status: 'completed', conclusion: 'success', head_sha: 'portal', updated_at: '2026-09-12T00:00:30Z' },
    { name: 'Rinne Ops Board', head_branch: 'develop', status: 'completed', conclusion: 'success', head_sha: 'ops', updated_at: '2026-09-12T00:01:00Z' },
    { name: 'Lanternfell night portrait DEV', status: 'completed', conclusion: 'failure', head_sha: 'lantern', updated_at: '2026-09-12T00:02:00Z' },
  ];
  const apps = buildApplications({ entries: [] }, environments, runs);
  const portal = apps.find(app => app.id === 'portal');
  const ops = apps.find(app => app.id === 'ops-board');
  const visual = apps.find(app => app.id === 'visual-review');
  const lantern = apps.find(app => app.id === 'lanternfell');
  assert.equal(portal.targets[0].url, PORTAL_PUBLIC_URL);
  assert.equal(portal.targets[0].state, 'success');
  assert.equal(portal.name, 'WAYFINDER');
  assert.equal(visual.name, 'Visual Review Lab');
  assert.equal(ops.name, 'PULSE');
  assert.equal(ops.targets[0].url, OPS_PUBLIC_URL);
  assert.equal(lantern.targets[0].state, 'failed');
  assert.equal(lantern.targets[0].url, null);
  assert.match(lantern.targets[0].note, /表示しません/);
});

test('fast DEV stays app-scoped and does not infer success without exact status',()=>{
  const apps=buildApplications({entries:[]},[],[],{developSha:'head',statuses:[
    {context:'dev/demon',state:'pending',updated_at:'2026-09-19T00:00:00Z'},
    {context:'dev/village',state:'failure',updated_at:'2026-09-19T00:00:01Z'},
  ]});
  const demon=apps.find(app=>app.id==='demon').targets[0];
  const village=apps.find(app=>app.id==='village').targets[0];
  const rinne=apps.find(app=>app.id==='rinne').targets[0];
  assert.equal(demon.state,'deploying');assert.equal(demon.commit,null);
  assert.equal(village.state,'failed');assert.equal(village.commit,null);
  assert.equal(rinne.state,'waiting');assert.equal(rinne.commit,null);
});
