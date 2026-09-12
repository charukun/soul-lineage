import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildState, environmentFromManifest } from '../ops-board/collector.mjs';
import { degradedState } from '../ops-board/fallback-state.mjs';
import { assertVersion, assertSnapshot } from '../ops-board/publication-check.mjs';
import { appHealth, boardAlerts } from '../ops-board/public/health.mjs';
import { buildApplications } from '../ops-board/applications.mjs';
const sha = 'a'.repeat(40), prodSha = 'b'.repeat(40), stagedSha = 'c'.repeat(40);
const now = new Date().toISOString();
const manifest = { schemaVersion: 1, entries: ['rinne','village','demon'].flatMap(app => [
  { app, environment:'dev', path:`dev/${app}`, version:{commit:sha} },
  { app, environment:'staging', path:`staging/${app}`, version:{commit:stagedSha} },
  { app, environment:'prod', path:`prod/${app}`, version:{commit:prodSha} },
]), environmentSnapshots: { dev:{commit:sha,branch:'develop',deployedAt:now}, staging:{commit:stagedSha,branch:'develop',deployedAt:now}, prod:{commit:prodSha,branch:'main',deployedAt:now} } };
const response = data => new Response(JSON.stringify(data), { headers:{'content-type':'application/json'} });
const collectorFetch = async url => {
  const u = new URL(url);
  if (u.hostname === 'charukun.github.io') return response(manifest);
  if (u.pathname.endsWith('/branches')) return response([{name:'develop',commit:{sha}},{name:'main',commit:{sha:prodSha}}]);
  if (u.pathname.endsWith('/pulls') || u.pathname.endsWith('/commits')) return response([]);
  if (u.pathname.endsWith('/actions/runs')) return response({workflow_runs:[]});
  throw new Error('Unexpected route '+url);
};
test('collector preserves the three current environments and exact pinned staging history', async () => {
  const state = await buildState(null, {fetchImpl:collectorFetch});
  assert.deepEqual(state.environments.map(e=>e.id), ['dev','staging','prod']);
  assert.equal(state.environments[1].deployedCommit, stagedSha);
  assert.equal(state.environments[1].branch, 'develop');
  assert.equal(state.environments[1].deployState, 'success');
  assert.equal(state.applications.find(a=>a.id==='ops-board').name,'PULSE');
  assert.equal(state.applications.find(a=>a.id==='demon').name,'尽喰廻遊');
  assert.equal(state.applicationsSource,'public-manifest');
  assert.doesNotThrow(()=>assertSnapshot({...state,buildCommit:sha},sha));
});
test('mixed-source production never becomes an assumed main deployment', () => {
  const m={schemaVersion:1,entries:[{environment:'prod',version:{commit:'first'}},{environment:'prod',version:{commit:'second'}}]};
  const env=environmentFromManifest('prod',m,prodSha,null);
  assert.equal(env.deployedCommit,null); assert.equal(env.exactCommit,false);
  assert.deepEqual(env.sourceCommits,['first','second']);
});
test('recovery rejects an old Worker or a different static SHA before priming', () => {
  assert.doesNotThrow(()=>assertVersion({app:'ops-board',commit:sha},sha));
  assert.throws(()=>assertVersion({app:'ops-board',commit:prodSha},sha),/different deployed source/);
  assert.throws(()=>assertSnapshot({repository:'charukun/soul-lineage',schemaVersion:1,syncStatus:'ok'},sha),/Old Worker/);
});
test('schema2 without target lookup cannot masquerade as a completed zero-target prime', async () => {
  const state=await buildState(null,{fetchImpl:collectorFetch}); state.buildCommit=sha;
  delete state.pullRequests.targetLookup;
  assert.throws(()=>assertSnapshot(state,sha),/lookup metadata/);
});
test('partial public fallback preserves names, environment matrix and real GitHub retrieval time', async () => {
  const previous={generatedAt:'2026-09-11T00:00:00Z',applications:[],alerts:[],environments:[],pullRequests:{normal:[],visualReview:[],total:0}};
  const error=Object.assign(new Error('GitHub HTTP 403'),{retryAt:Date.now()+60000});
  const state=await degradedState(previous,error,{now,fetchImpl:async()=>response(manifest)});
  assert.equal(state.schemaVersion,2); assert.equal(state.syncStatus,'degraded');
  assert.equal(state.generatedAt,previous.generatedAt); assert.equal(state.applicationsUpdatedAt,now);
  assert.deepEqual(state.environments.map(e=>e.id),['dev','staging','prod']);
  assert.equal(state.applications.find(a=>a.id==='demon').name,'尽喰廻遊');
  assert.equal(boardAlerts(state).filter(a=>['sync-failed','github-sync-degraded'].includes(a.type)).length,1);
  assert.ok(state.nextRetryAt);
});
test('both data-source failures retain old facts and report both errors', async()=>{
  const previous={generatedAt:'2026-09-11T00:00:00Z',applications:[],environments:[]};
  const state=await degradedState(previous,new Error('GitHub 429'),{now,fetchImpl:async()=>new Response('',{status:503})});
  assert.equal(state.generatedAt,previous.generatedAt); assert.equal(state.applications,previous.applications);
  assert.match(state.manifestSyncError,/503/); assert.match(state.syncError,/429/);
});
test('unpublished and unverified applications are never summarized as normal',()=>{
  assert.deepEqual(appHealth({targets:[{state:'success'},{state:'missing'}]}),['未公開あり','info']);
  assert.deepEqual(appHealth({targets:[{state:'success',updateState:'failed'}]}),['要対応','danger']);
  const app=buildApplications({},[],[{name:'Wayfinder Public Gallery',status:'completed',conclusion:'cancelled'}]).find(a=>a.id==='portal');
  assert.notEqual(app.targets[0].state,'failed'); assert.notEqual(app.targets[0].state,'success');
});
test('a resolved CI warning disappears and a stale delivery is surfaced once',()=>{
  const state={generatedAt:now,syncStatus:'ok',alerts:[{type:'ci-failed',prNumber:85}],integration:{queue:[],stalled:true,heartbeatAt:'2026-09-11T00:00:00Z'}};
  const alerts=boardAlerts(state);
  assert.equal(alerts.some(a=>a.type==='ci-failed'),false);
  assert.equal(boardAlerts({...state,alerts}).filter(a=>a.type==='delivery-stalled').length,1);
});
test('publication workflow checks exact source before authenticated prime and retains browser gates',()=>{
  const source=readFileSync(new URL('../.github/workflows/ops-board.yml',import.meta.url),'utf8');
  assert.ok(source.indexOf('publication-check.mjs version') < source.indexOf('node ops-board/prime.mjs'));
  assert.match(source,/OPS_BUILD_SHA:\$GITHUB_SHA/);
  assert.match(source,/ops-review-results\/public/);
  assert.equal((source.match(/node ops-board\/browser-check.mjs/g)||[]).length,2);
});
