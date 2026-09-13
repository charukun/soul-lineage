import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPOSITORY, rescueConfig, newState, conflictScope, compareScopes, evaluateSnapshot, manualReason, integrationRescueReason,
  detectReason, planWave, owned, heartbeat, recoverStale, failure, transition, ACTIVE } from '../scripts/integration-rescue-policy.mjs';
import { RescueStore, contractFingerprint } from '../scripts/integration-rescue-store.mjs';
import { coordinate } from '../scripts/integration-rescue-coordinator.mjs';
import { returnToIntegration } from '../scripts/integration-rescue-return.mjs';
import { preflight, workerPrompt, assertAssertionsPreserved, validateResolutionReport } from '../scripts/integration-rescue-worker.mjs';
import { wakeRescue } from '../scripts/integration-rescue-watchdog-worker.mjs';
import { eligibility } from '../scripts/integration-policy.mjs';

const now = Date.parse('2026-09-13T10:00:00Z'), date = new Date(now - 3600000).toISOString();
const sha = 'a'.repeat(40), develop = 'b'.repeat(40);
const pr = (n = 1, overrides = {}) => ({ number: n, state: 'open', draft: false, title: `PR ${n}`, body: 'Depends-On: none', labels: [], author_association: 'OWNER',
  head: { sha, ref: `feat/${n}`, repo: { full_name: REPOSITORY } }, base: { ref: 'develop', repo: { full_name: REPOSITORY } },
  mergeable: false, mergeable_state: 'dirty', changed_files: 1, additions: 20, deletions: 3, created_at: date, updated_at: date, ...overrides });
const record = (n, files = [`apps/app-${n}/src/a.js`], extra = {}) => ({ pr: n, title: `Repair ${n}`, branch: `feat/${n}`, headSha: sha, developSha: develop, mergeBaseSha: sha,
  scope: conflictScope(files), dependencies: [], mergedDependencies: [], changes: 23, detectedAt: date,
  state: 'QUEUED', attempt: 0, maxAttempts: 3, reason: 'MERGE_CONFLICT', ...extra });
function stateWith(...records) { const s = newState(); for (const r of records) s.records[r.pr] = r; return s; }
function claim(s, runId = '10') { return planWave(s, { runId, now, id: `wave-${runId}` }); }

function memoryStore(initial, handlers = {}) {
  let current = structuredClone(initial), version = 1;
  const writes = [], calls = [];
  const c = { root: `/repos/${REPOSITORY}`, async api(method, path, body) {
    calls.push({ method, path, body });
    await Promise.resolve(); // Allow concurrent readers to race on the same SHA.
    if (path.includes('/contents/rescue-state.json')) {
      if (method === 'GET') return { sha: String(version), encoding: 'base64', content: Buffer.from(JSON.stringify(current)).toString('base64') };
      assert.equal(body.branch, 'automation/integration-rescue-state');
      if (body.sha !== String(version)) throw new Error('GitHub PUT: HTTP 409');
      current = JSON.parse(Buffer.from(body.content, 'base64')); version++; writes.push(body); return {};
    }
    if (handlers.api) return handlers.api(method, path, body);
    throw new Error(`Unexpected API ${method} ${path}`);
  }, async pages(path, key) { if (handlers.pages) return handlers.pages(path, key); throw new Error(`Unexpected pages ${path}`); } };
  return { c, store: new RescueStore(c, initial.config, async () => {}), current: () => structuredClone(current), calls, writes };
}

test('four independent PRs occupy four real worker slots, fifth waits', () => {
  const s = stateWith(...[1,2,3,4,5].map(n => record(n)));
  const wave = claim(s);
  assert.equal(wave.length, 4); assert.equal(new Set(wave.map(w => w.workerId)).size, 4);
  assert.equal(Object.values(s.records).filter(r => r.lease).length, 4); assert.equal(s.records[5].state, 'QUEUED');
});
test('same PR cannot be claimed by a second Coordinator; completed worker frees a global slot', () => {
  const s = stateWith(...[1,2,3,4,5].map(n => record(n))); claim(s);
  assert.equal(claim(s, '11').length, 0);
  s.records[1].lease = null; transition(s, s.records[1], 'CHECKING', 'returned', now);
  assert.deepEqual(claim(s, '12').map(w => w.pr), [5]);
});
test('CAS state update handles concurrent Coordinators without double claim or lost slots', async () => {
  const memory = memoryStore(stateWith(...[1,2,3,4,5,6].map(n => record(n))));
  const results = await Promise.all([10,11,12,13].map(runId => memory.store.mutate(s => claim(s, String(runId)))));
  assert.equal(results.reduce((n, r) => n + r.result.length, 0), 4);
  assert.equal(Object.values(memory.current().records).filter(r => r.lease).length, 4);
});
test('concurrent worker heartbeats retain each other and never mutate claims through progress', async () => {
  const s = stateWith(record(1),record(2)); const claims = claim(s); const memory = memoryStore(s);
  await Promise.all(claims.map(w => memory.store.mutate(state => heartbeat(state,w.pr,w.rescueId,w.workerId,{ currentAction:'独立して解析中', state:'MERGED', lease:null },now+1000))));
  const records = Object.values(memory.current().records);
  assert.ok(records.every(r => r.lease && r.state === 'CLAIMED' && r.currentAction === '独立して解析中'));
});
test('configuration is centralized, configurable and rejects invalid concurrency/attempts', () => {
  assert.equal(rescueConfig().maxConcurrency, 4); assert.equal(rescueConfig().maxAttempts, 3);
  assert.equal(rescueConfig({ MAX_RESCUE_CONCURRENCY:'8' }).maxConcurrency, 8);
  for (const n of ['0','17','NaN','1.5','-1']) assert.throws(() => rescueConfig({ MAX_RESCUE_CONCURRENCY:n }));
});
test('village and demon are GREEN and actually share a wave', () => {
  const a = record(1,['apps/village/src/a.js']), b = record(2,['apps/demon/src/a.js']);
  assert.equal(compareScopes(a.scope,b.scope).risk,'GREEN'); assert.equal(claim(stateWith(a,b)).length,2);
});
test('same package different files is YELLOW, allowed with post-push recheck', () => {
  const a=record(1,['apps/village/src/a.js']), b=record(2,['apps/village/src/b.js']); const s=stateWith(a,b);
  assert.equal(compareScopes(a.scope,b.scope).risk,'YELLOW'); assert.equal(claim(s).length,2); assert.equal(b.risk,'YELLOW');
});
test('same file cannot enter the same Wave; RETURNED still owns RED ordering lock until merge', () => {
  const s=stateWith(record(1,['apps/village/src/a.js']),record(2,['apps/village/src/a.js']));
  assert.equal(claim(s).length,1); assert.equal(s.records[2].state,'BLOCKED_BY_RESCUE');
  s.records[1].lease=null; s.records[1].state='CHECKING'; assert.equal(claim(s,'11').length,0);
  s.records[1].state='MERGED'; assert.deepEqual(claim(s,'12').map(w=>w.pr),[2]);
});
test('shared character and rendering changes include transitive app consumers', () => {
  for (const name of ['characters','rendering']) {
    const a=conflictScope([`packages/${name}/src/index.js`],'',{[`packages/${name}`]:['apps/village','apps/rinne']});
    assert.equal(compareScopes(a,conflictScope(['apps/village/src/a.js'])).risk,'RED');
    assert.equal(compareScopes(a,conflictScope(['docs/notes.md'])).risk,'GREEN');
  }
});
test('schema/save/API/control/specification changes serialize, including rename aliases', () => {
  for (const file of ['packages/game-data/schema.js','apps/village/save-format.js','apps/demon/api-contract.js','.github/workflows/ci.yml']) {
    assert.equal(compareScopes(conflictScope([file]),conflictScope(['apps/other/src/a.js'])).risk,'RED');
  }
  assert.equal(compareScopes(conflictScope(['apps/a/new.js','apps/a/old.js']),conflictScope(['apps/a/old.js'])).risk,'RED');
  assert.equal(compareScopes(conflictScope(['apps/a/x.js'],'Rescue-Spec: save-v2'),conflictScope(['apps/b/x.js'],'Rescue-Spec: save-v2')).risk,'RED');
});
test('Depends-On roots precede followers despite disjoint files and follower age', () => {
  const s=stateWith(record(1,undefined,{dependencies:[2]}),record(2));
  assert.deepEqual(claim(s).map(w=>w.pr),[2]); assert.deepEqual(s.records[1].blockedBy,[2]);
  s.records[2].lease=null;s.records[2].state='MERGED';s.records[1].mergedDependencies=[2];
  assert.deepEqual(claim(s,'11').map(w=>w.pr),[1]);
});
test('repair priority takes precedence over FIFO without unbounded concurrency', () => {
  const s=stateWith(...[1,2,3,4].map(n=>record(n)),record(8,undefined,{repair:true}));
  assert.equal(claim(s)[0].pr,8); assert.equal(s.records[8].priority.label,'HIGH');
});
test('changed head fences all stale results; related develop requires retry', () => {
  const r=record(1,['apps/village/src/a.js']);
  assert.deepEqual(evaluateSnapshot(r,{head:'new',develop,baseChanges:[]}),{valid:false,reason:'HEAD_CHANGED'});
  assert.equal(evaluateSnapshot(r,{head:sha,develop:'new',baseChanges:['apps/village/src/a.js']}).valid,false);
  assert.equal(evaluateSnapshot(r,{head:sha,develop:'new',baseChanges:['apps/village/src/b.js']}).valid,false);
});
test('unrelated develop change does not cancel independent workers', () => {
  const r=record(1,['apps/village/src/a.js']);
  const result=evaluateSnapshot(r,{head:sha,develop:'new',baseChanges:['apps/demon/src/a.js']});
  assert.equal(result.valid,true);assert.equal(result.recheck,false);
});
test('missing comparison data fails closed',()=>assert.equal(evaluateSnapshot(record(1),{head:sha,develop:'new'}).valid,false));
test('stale heartbeat is visible but cannot evict a still-running GitHub runner',()=>{
  const s=stateWith(record(1));claim(s);recoverStale(s,{'10':'in_progress'},now+s.config.staleMs+1);
  assert.equal(s.records[1].state,'STALE');assert.ok(s.records[1].lease);assert.equal(claim(s,'11').length,0);
});
test('dead run and expired heartbeat release lease for bounded recovery',()=>{
  const s=stateWith(record(1));const [old]=claim(s);recoverStale(s,{'10':'completed'},now+s.config.staleMs+1);
  assert.equal(s.records[1].state,'FAILED_RETRYABLE');assert.equal(s.records[1].lease,null);
  assert.throws(()=>owned(s,1,old.rescueId,old.workerId),/CLAIM_REJECTED/);
  const retry=planWave(s,{runId:'11',id:'wave-11',now:now+s.config.staleMs+s.config.retryMs+2});
  assert.equal(retry[0].pr,1);assert.equal(s.records[1].attempt,2);assert.notEqual(retry[0].rescueId,old.rescueId);
  assert.equal(s.records[1].failures[0].reason,'WORKER_STALE');
});
test('worker death without expired heartbeat is retryable only after run completion',()=>{
  const s=stateWith(record(1));claim(s);recoverStale(s,{'10':'completed'},now+1000);assert.equal(s.records[1].failureReason,'WORKER_DIED');
});
test('retry max sends manual notice and does not loop',()=>{
  const s=stateWith(record(1,undefined,{attempt:2}));claim(s);failure(s,s.records[1],'test failure',now);
  assert.equal(s.records[1].state,'FAILED_MANUAL');assert.equal(s.outbox.length,1);assert.equal(claim(s,'20').length,0);
});
test('replaced worker cannot heartbeat or publish another claim',()=>{
  const s=stateWith(record(1));const [c]=claim(s);
  assert.throws(()=>heartbeat(s,1,'wrong',c.workerId,{},now),/CLAIM_REJECTED/);
  assert.throws(()=>owned(s,1,c.rescueId,'other'),/CLAIM_REJECTED/);
});
test('watchdog discovers orphan and pending queue, and recognizes machine-readable reasons',()=>{
  const base={pr:pr(1,{mergeable:true,mergeable_state:'clean'}),mergeBase:develop,develop,now,config:rescueConfig()};
  assert.equal(detectReason(base),'ORPHAN_READY');
  assert.equal(detectReason({...base,queue:{state:'pending',created_at:date,description:'Held'}}),'QUEUE_PENDING');
  assert.equal(integrationRescueReason('overlapping changes since PR base require Integration review'),'DEVELOP_OVERLAP');
  assert.equal(integrationRescueReason('GitHub HTTP 502'),'INTEGRATION_TRANSIENT');
});
test('Draft, holds, requested changes, unresolved threads, untrusted and protected targets stay manual',()=>{
  const cases=[pr(1,{draft:true}),pr(1,{labels:[{name:'integration:manual'}]}),pr(1,{labels:[{name:'do-not-merge'}]}),pr(1,{body:'Integration-Hold: product decision'}),pr(1,{author_association:'CONTRIBUTOR'}),pr(1,{base:{ref:'main',repo:{full_name:REPOSITORY}}}),pr(1,{head:{sha,ref:'main',repo:{full_name:REPOSITORY}}}),pr(1,{head:{sha,ref:'feat/x',repo:{full_name:'external/fork'}}})];
  for(const p of cases)assert.ok(manualReason(p));
  assert.equal(manualReason(pr(),{reviews:[{id:1,user:{login:'owner'},state:'CHANGES_REQUESTED'}]}),'CHANGES_REQUESTED');
  assert.equal(manualReason(pr(),{unresolved:true}),'UNRESOLVED_THREAD');
});
test('semantic worker retains objectives, old failure evidence and refuses whole-side/validation shortcuts',()=>{
  const r=record(1,undefined,{failures:[{reason:'API contract conflict'}]});const prompt=workerPrompt(r,pr(),['apps/a.js']);
  for(const text of ['BOTH intended behaviors','ours/theirs','FAILED_MANUAL','API contract conflict','Do not remove tests'])assert.ok(prompt.includes(text));
  assert.throws(()=>validateResolutionReport({decision:'READY',purposePreserved:false,validationPreserved:true},r));
  assert.throws(()=>assertAssertionsPreserved('assert.equal(actual, 4);\ntest("x", () => {})','test("x", () => {})','a.test.js'),/ASSERTION_REMOVAL/);
  assert.doesNotThrow(()=>assertAssertionsPreserved('assert.equal(actual, 4);','assert.equal(actual, 4);\nassert.ok(extra);','a.test.js'));
});
test('return dispatch carries no validation/approval bypass and exact head remains required',async()=>{
  const s=stateWith(record(1,undefined,{state:'PUSHED',pushedSha:sha,pendingIntegration:true,rescueId:'r1'}));const dispatches=[];
  const mem=memoryStore(s,{api(method,path,body){if(path.includes('/pulls/1'))return pr();if(path.endsWith('/dispatches')){dispatches.push(body);return null;}throw new Error(path);}});
  assert.deepEqual(await returnToIntegration(mem.c,mem.store,now),[1]);assert.deepEqual(dispatches,[{ref:'develop'}]);
  assert.equal(mem.current().records[1].state,'CHECKING');
  assert.deepEqual(await returnToIntegration(mem.c,mem.store,now),[]);
  const input={pr:pr(1,{mergeable:true,mergeable_state:'clean'}),repository:REPOSITORY,files:['apps/village/a.js'],reviews:[],unresolved:false,dependenciesMerged:true,checksPassed:false};
  assert.match(eligibility(input),/current head fast gate/);
  assert.match(eligibility({...input,checksPassed:true,unresolved:true}),/unresolved/);
});
test('watchdog is independent from PULSE, dispatches only develop scan and reports failures',async()=>{
  let call;await wakeRescue({RESCUE_GITHUB_TOKEN:'test'},async(url,options)=>{call={url,options};return {ok:true};});
  assert.deepEqual(JSON.parse(call.options.body),{ref:'develop',inputs:{rescue_mode:'scan'}});
  assert.ok(!call.url.includes('ops'));await assert.rejects(wakeRescue({},()=>{}),/not configured/);
  await assert.rejects(wakeRescue({RESCUE_GITHUB_TOKEN:'test'},async()=>({ok:false,status:403})),/HTTP 403/);
});
test('real workflow uses matrix isolation with pool cap and per-PR fencing, no force/history rewrite',()=>{
  const workflow=readFileSync('.github/workflows/integration-rescue.yml','utf8');
  assert.match(workflow,/strategy:[\s\S]*fail-fast: false[\s\S]*max-parallel:/);
  assert.match(workflow,/group: integration-rescue-pr-\$\{\{ matrix.pr \}\}/);
  assert.match(workflow,/path: control/);assert.match(workflow,/path: work/);assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/openai\/codex-action|OPENAI_API_KEY|RESCUE_GITHUB_TOKEN/);assert.match(workflow,/sudo chown -R root:root control/);
  const worker=readFileSync('scripts/integration-rescue-worker.mjs','utf8');
  assert.doesNotMatch(worker,/'--force'|'--force-with-lease'|'rebase'|\/merge`/);
  assert.match(worker,/validate\.mjs/);assert.match(worker,/assertAssertionsPreserved/);
});
test('coordinator discovers multiple independent PRs and makes one four-worker Wave',async()=>{
  const pulls=[1,2,3,4,5].map(n=>pr(n));
  const mem=memoryStore(newState(),{api(method,path,body){
    if(path.endsWith('/branches/develop'))return {commit:{sha:develop}};
    if(path.match(/\/pulls\/\d+$/))return pulls.find(p=>path.endsWith('/'+p.number));
    if(path==='/graphql')return {data:{repository:{pullRequest:{reviewThreads:{nodes:[],pageInfo:{hasNextPage:false}}}}}};
    if(path.includes('/compare/'))return {merge_base_commit:{sha:develop},files:[],status:'ahead',ahead_by:1};
    throw new Error(path);
  },pages(path){
    if(path.startsWith('/pulls?'))return pulls;
    if(path.startsWith('/issues?'))return [];
    if(path.endsWith('/reviews'))return [];
    if(path.endsWith('/files'))return [{filename:`apps/app-${path.split('/')[2]}/src/a.js`}];
    if(path.includes('/statuses'))return [];
    throw new Error(path);
  }});
  const result=await coordinate(mem.c,mem.store,{now,runId:'44'});
  assert.equal(result.errors.length,0);assert.equal(result.result.length,4);assert.equal(mem.current().records[5].state,'QUEUED');
});
test('explicitly disabled coordinator never pretends workers are running',async()=>{
  const mem=memoryStore(newState(),{api(){return {commit:{sha:develop}};},pages(){return [];}});
  const result=await coordinate(mem.c,mem.store,{now,runId:'45',configured:false});
  assert.deepEqual(result.result,[]);assert.equal(result.state.coordinator.phase,'CONFIGURATION_REQUIRED');
});

test('concurrent return jobs dispatch one exact head only once', async () => {
  const s=stateWith(record(1,undefined,{state:'PUSHED',pushedSha:sha,pendingIntegration:true,rescueId:'r1'}));let dispatches=0;
  const mem=memoryStore(s,{api(method,path){if(path.includes('/pulls/1'))return pr();if(path.endsWith('/dispatches')){dispatches++;return null;}throw new Error(path);}});
  const results=await Promise.all([returnToIntegration(mem.c,mem.store,now),returnToIntegration(mem.c,mem.store,now)]);
  assert.equal(dispatches,1);assert.equal(results.flat().length,1);
});
test('changed head before return is retried without stale dispatch or retained dispatch lease', async () => {
  const s=stateWith(record(1,undefined,{state:'PUSHED',pushedSha:sha,pendingIntegration:true,rescueId:'r1'}));
  const mem=memoryStore(s,{api(method,path){if(path.includes('/pulls/1'))return pr(1,{head:{sha:'new'}});throw new Error(path);}});
  assert.deepEqual(await returnToIntegration(mem.c,mem.store,now),[]);
  assert.equal(mem.current().records[1].state,'FAILED_RETRYABLE');assert.equal(mem.current().records[1].dispatchLease,null);
});
test('same-head PR purpose edits are rejected at worker preflight', async () => {
  const original=pr(), changed=pr(1,{body:'Depends-On: #2'});
  const mem=memoryStore(newState(),{api(method,path){if(path.includes('/pulls/1'))return changed;if(path==='/graphql')return {data:{repository:{pullRequest:{reviewThreads:{nodes:[],pageInfo:{hasNextPage:false}}}}}};throw new Error(path);},pages(){return [];}});
  await assert.rejects(preflight(mem.c,record(1,undefined,{contractFingerprint:contractFingerprint(original)}),{}),/PR_CONTRACT_CHANGED/);
});
test('event bursts reuse the recent scan and do not repeat PR enumeration', async () => {
  const s=newState();s.coordinator={heartbeatAt:new Date(now).toISOString(),configured:true,develop};
  const mem=memoryStore(s);
  const result=await coordinate(mem.c,mem.store,{now:now+1000,runId:'99'});
  assert.deepEqual(result.result,[]);assert.equal(mem.calls.length,1);
});
