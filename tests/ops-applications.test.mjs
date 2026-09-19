import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplications, OPS_PUBLIC_URL, PORTAL_PUBLIC_URL } from '../apps/pulse/applications.mjs';

test('game DEV uses exact per-app Worker status while Pages is staging/production compatibility only', () => {
  const manifest={entries:[
    {app:'rinne',environment:'prod',path:'prod',version:{name:'輪廻転焦',commit:'prod-rinne'}},
    {app:'village',environment:'staging',path:'staging/village',version:{name:'MURAAAAAAA',commit:'stage-village'}},
  ]};
  const apps=buildApplications(manifest,[],[],{developSha:'develop-head',statuses:[{context:'dev/rinne',state:'success',updated_at:'2026-09-19T00:00:30Z'}]});
  const rinne=apps.find(app=>app.id==='rinne');
  assert.equal(rinne.targets[0].label,'高速DEV');
  assert.equal(rinne.targets[0].url,'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/');
  assert.equal(rinne.targets[0].commit,'develop-head');
  assert.equal(rinne.targets.find(t=>t.environment==='prod').url,'https://charukun.github.io/soul-lineage/prod/');
});

test('Character Studio and Visual Review have independent fast DEV identities',()=>{
  const statuses=[
    {context:'dev/character-studio',state:'success',updated_at:'2026-09-19T00:01:00Z'},
    {context:'dev/review',state:'success',updated_at:'2026-09-19T00:02:00Z'},
  ];
  const apps=buildApplications({entries:[]},[],[],{developSha:'tool-head',statuses});
  const studio=apps.find(app=>app.id==='character-studio');
  const review=apps.find(app=>app.id==='visual-review');
  assert.equal(studio.kind,'tool');
  assert.equal(studio.targets[0].url,'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/');
  assert.equal(studio.targets[0].commit,'tool-head');
  assert.equal(review.kind,'tool');
  assert.equal(review.targets[0].url,'https://soul-lineage-review-dev.c-okamoto.workers.dev/');
  assert.equal(review.targets[0].commit,'tool-head');
  for(const app of [studio,review]) assert.doesNotMatch(app.targets[0].url,/github\.io/);
});

test('PULSE and WAYFINDER preserve their stable public Worker URLs',()=>{
  const runs=[
    {name:'Wayfinder Public Gallery',status:'completed',conclusion:'success',head_sha:'portal',updated_at:'2026-09-19T00:00:30Z'},
    {name:'Rinne Ops Board',head_branch:'develop',status:'completed',conclusion:'success',head_sha:'ops',updated_at:'2026-09-19T00:01:00Z'},
  ];
  const apps=buildApplications({entries:[]},[],runs);
  assert.equal(apps.find(app=>app.id==='portal').targets[0].url,PORTAL_PUBLIC_URL);
  assert.equal(apps.find(app=>app.id==='ops-board').targets[0].url,OPS_PUBLIC_URL);
});

test('fast DEV fails closed without exact status',()=>{
  const apps=buildApplications({entries:[]},[],[],{developSha:'head',statuses:[
    {context:'dev/demon',state:'pending',updated_at:'2026-09-19T00:00:00Z'},
    {context:'dev/village',state:'failure',updated_at:'2026-09-19T00:00:01Z'},
  ]});
  assert.equal(apps.find(app=>app.id==='demon').targets[0].state,'deploying');
  assert.equal(apps.find(app=>app.id==='village').targets[0].state,'failed');
  assert.equal(apps.find(app=>app.id==='rinne').targets[0].state,'waiting');
});
