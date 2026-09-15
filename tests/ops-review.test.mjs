import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pullCopy, bodyLines, compactPull, isVisualReviewPull } from '../ops-board/pulls.mjs';
import { appSummary, appHealth, boardAlerts, ageLabel } from '../ops-board/public/health.mjs';
import { enrichTargets, targetRevision, actionProblems } from '../ops-board/review-model.mjs';
import { createGithubClient, readStored, writeStored } from '../ops-board/github-client.mjs';
import { classifyPull, workflowFailure, publishedCommit, environmentDiff } from '../ops-board/model.mjs';
class Storage {
  values = new Map();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { if (typeof key === 'string') this.values.set(key, structuredClone(value)); else for (const [k,v] of Object.entries(key)) this.values.set(k,structuredClone(v)); }
  async delete(key) { this.values.delete(key); }
  async transaction(fn) { return fn(this); }
}
const pr = extra => ({ number: 31, title: '本来の修正タイトル', body: '## Summary\n\n- 本文の変更概要', state: 'open', draft: false, head: { ref: 'feat/x', sha: 'a'.repeat(40) }, base: { sha: 'b'.repeat(40) }, changed_files: 1, updated_at: '2026-09-12T00:00:00Z', ...extra });
const jsonResponse = (data, headers = {}, status = 200) => new Response(JSON.stringify(data), { status, headers });
const run = (id, conclusion, extra = {}) => ({ id, name: 'CI', workflow_id: 1, status: 'completed', conclusion, head_branch: 'feat/x', head_sha: 'a'.repeat(40), event: 'pull_request', created_at: new Date(1789171200000 + id * 10000).toISOString(), ...extra });

test('two plain body lines are retained exactly', () => {
  assert.deepEqual(pullCopy(pr({ body: '短いタイトル\r\n簡潔な詳細\n第三行' })), { title: '短いタイトル', detail: '簡潔な詳細' });
  assert.deepEqual(bodyLines('題\n説明'), { title: '題', detail: '説明' });
});
test('legacy Summary heading uses GitHub title and meaningful body, without mutation', () => {
  const source = pr(); const before = JSON.stringify(source);
  assert.deepEqual(pullCopy(source), { title: '本来の修正タイトル', detail: '本文の変更概要' });
  assert.equal(JSON.stringify(source), before);
});
test('leading comments and blank lines never become PR titles', () => {
  assert.equal(pullCopy(pr({ body: '<!-- template -->\n\n## Changes\n- 内容です' })).detail, '内容です');
  assert.equal(pullCopy(pr({ body: '' })).title, '本来の修正タイトル');
});
test('only the dedicated Lab branch is separated, and its stale hint is disabled', () => {
  assert.equal(isVisualReviewPull(pr({ title: 'Visual Review の修正' })), false);
  const lab = pr({ draft: true, head: { ref: 'work/visual-review-lab-v2', sha: 'head' } });
  assert.equal(compactPull(lab, Date.parse('2026-09-13T00:00:00Z')).staleDraft, false);
  assert.equal(compactPull(lab).visualReview, true);
});
test('unknown target results do not claim complete coverage', () => { assert.equal(compactPull(pr()).targetsComplete, false); });
test('degraded snapshot and CI failure are both raised in action items', () => {
  const state = { generatedAt: '2026-09-12T00:00:00Z', syncStatus: 'degraded', syncError: 'HTTP 429', alerts: [], integration: { queue: [{ number: 85, title: 'fix', stage: 'CI_FAILED', ci: { url: 'https://github.com/x/run' } }] } };
  const alerts = boardAlerts(state, Date.parse('2026-09-12T00:07:00Z'));
  assert.ok(alerts.some(a => a.type === 'sync-failed'));
  assert.ok(alerts.some(a => a.type === 'ci-failed' && a.prNumber === 85));
  assert.equal(boardAlerts({ ...state, alerts }, Date.parse('2026-09-12T00:07:00Z')).filter(a => a.type === 'ci-failed').length, 1);
});
test('stale and missing snapshots cannot silently look normal', () => {
  assert.ok(boardAlerts({ generatedAt: '2026-09-12T00:00:00Z' }, Date.parse('2026-09-12T00:11:00Z')).some(a => a.type === 'sync-stale'));
  assert.ok(boardAlerts({}).some(a => a.type === 'sync-unavailable'));
  assert.equal(ageLabel(7 * 60000), '7分前');
});
test('unknown apps stay unknown rather than making the section healthy', () => {
  assert.deepEqual(appHealth({ targets: [{ state: 'unknown' }] }), ['未確認', 'info']);
  assert.match(appSummary([{ targets: [{ state: 'unknown' }] }]), /未確認 1/);
  assert.doesNotMatch(appSummary([{ targets: [{ state: 'unknown' }] }]), /正常/);
});
test('cancellations and skips are not CI success or current failures', () => {
  assert.equal(workflowFailure(run(1, 'cancelled')), false);
  for (const conclusion of ['cancelled','skipped','neutral']) assert.equal(classifyPull(pr(), [run(1,conclusion)]).warning, undefined);
});
test('current failures, resolved failures, and cancellations are separated per workflow lane', () => {
  const result = actionProblems([run(3,'success'),run(2,'failure'),run(1,'cancelled'),run(4,'failure',{ head_branch:'feat/other' })], [pr()]);
  assert.deepEqual(result.current.map(x => x.id), [4]);
  assert.equal(result.history.find(x => x.id === 2).historyLabel, '後続の成功で解消');
  assert.equal(result.history.find(x => x.id === 1).historyLabel, '中断');
});
test('closed PR and obsolete SHA failures stay in history', () => {
  assert.equal(actionProblems([run(1,'failure')], [pr({ state:'closed' })]).current.length, 0);
  assert.equal(actionProblems([run(1,'failure',{head_sha:'old'})], [pr()]).current.length, 0);
});
test('read/write durable snapshots round-trip beyond one storage value', async () => {
  const storage = new Storage(); const value = { text:'日本語🙂'.repeat(40000), items:[{a:1}] };
  await writeStored(storage, 'state', value); assert.deepEqual(await readStored(storage,'state'), value);
  for (const item of storage.values.values()) if (typeof item === 'string') assert.ok(item.length <= 16000);
  await writeStored(storage,'state',{x:1}); assert.deepEqual(await readStored(storage,'state'),{x:1}); assert.equal(storage.values.size, 2);
});
test('GitHub cache revalidates with ETag, saves no credentials and reuses immutable data', async () => {
  const storage = new Storage(); let calls = 0; let observed;
  const fetchImpl = async (url, options) => { calls++; observed = options.headers; return calls === 1 ? jsonResponse([{ id:1 }], { etag:'"a"', 'x-ratelimit-remaining':'4999' }) : new Response(null, {status:304}); };
  const client = createGithubClient({ storage, token:'test-secret-not-for-storage', fetchImpl });
  await client.get('/branches'); const b = await client.get('/branches');
  assert.equal(observed['if-none-match'], '"a"'); assert.equal(b.data[0].id,1);
  await client.get('/branches',{immutable:true}); assert.equal(calls,2);
  assert.doesNotMatch(JSON.stringify([...storage.values]), /test-secret-not-for-storage/);
});
test('rate-limited GitHub responses pause further requests until Retry-After', async () => {
  const storage = new Storage(); let calls = 0; const now = 1789171200000;
  const client = createGithubClient({ storage, now:()=>now, fetchImpl:async()=>{calls++;return jsonResponse({}, {'retry-after':'120'},429);} });
  await assert.rejects(client.get('/branches'), e => e.retryAt === now + 120000);
  await assert.rejects(client.get('/pulls'), /再取得待ち/); assert.equal(calls,1);
});
test('GitHub client cannot send a credential to another origin', async () => {
  const client = createGithubClient({token:'secret',fetchImpl:()=>{throw new Error('must not fetch');}});
  await assert.rejects(client.get('https://evil.invalid'),/Invalid/); await assert.rejects(client.get('//evil.invalid'),/Invalid/);
});
test('target lookup is cached by head/base, not comments or filter visits', async () => {
  const storage = new Storage(); let calls=0; const item=pr();
  const client={available:30,get:async path=>{calls++;return {data:path.includes('/files?')?[{filename:'apps/village/src/main.js'}]:item,response:{headers:new Headers()}};}};
  const first=await enrichTargets([item],client,storage,2); assert.equal(first.ready,1); assert.equal(first.pulls[0].targetApps[0].id,'village');
  const second=await enrichTargets([{...item,updated_at:'later'}],client,storage,2);assert.equal(second.ready,1);assert.equal(calls,2);
});
test('a changed head or base invalidates old target attribution', async () => {
  const storage=new Storage();const item=pr();await storage.put(`ops-targets:${item.number}`,{revision:targetRevision(item),complete:true,targets:[{id:'wrong',label:'stale'}]});
  const result=await enrichTargets([pr({head:{sha:'new',ref:'feat/x'}})],{available:0},storage,0);
  assert.equal(result.ready,0);assert.deepEqual(result.pulls[0].targetApps,[]);
});
test('renames attribute both sides and paginated files are checked for completeness', async () => {
  const item=pr({changed_files:101});const storage=new Storage();let pages=0;
  const client={available:40,get:async path=>{
    if(!path.includes('/files?'))return{data:item,response:{headers:new Headers()}};
    pages++;return{data:pages===1?Array.from({length:100},()=>({filename:'apps/rinne/a',previous_filename:'apps/village/a'})):[{filename:'portal/a'}],response:{headers:new Headers(pages===1?{link:'<x>; rel="next"'}:{})}};
  }};
  const r=await enrichTargets([item],client,storage,2);assert.equal(r.ready,1);assert.deepEqual(r.pulls[0].targetApps.map(x=>x.id),['rinne','village','portal']);
});
test('PR movement during target lookup cannot attach a stale classification', async () => {
  const item=pr();const storage=new Storage();
  const client={available:40,get:async path=>({data:path.includes('/files?')?[{filename:'apps/rinne/a'}]:pr({base:{sha:'new'}}),response:{headers:new Headers()}})};
  const r=await enrichTargets([item],client,storage,2);assert.equal(r.ready,0);assert.deepEqual(r.pulls[0].targetApps,[]);assert.equal(r.unavailable,1);
});
test('files count mismatch does not pretend complete attribution',async()=>{
  const item=pr({changed_files:3001});const client={available:40,get:async path=>({data:path.includes('/files?')?[{filename:'apps/rinne/a'}]:item,response:{headers:new Headers()}})};
  const r=await enrichTargets([item],client,new Storage(),2);assert.equal(r.ready,0);assert.equal(r.pulls[0].targetAppsStatus,'partial');
});
test('published SHA and exact public history remain the source of deployment comparisons',()=>{
  assert.equal(publishedCommit({environmentSnapshots:{dev:{commit:'public'}},validatedDevelop:'new-branch'},'dev').commit,'public');
  assert.equal(environmentDiff({historyComplete:false},{historyComplete:true}).count,null);
});
test('UI has a single snapshot fetch and no direct GitHub target calls',async()=>{
  const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
  const [pulls,view,html,css]=await Promise.all([read('ops-board/public/pull-board.js'),read('ops-board/public/view-state.js'),read('ops-board/public/index.html'),read('ops-board/public/review-polish.css')]);
  assert.doesNotMatch(pulls,/api\.github\.com|changedFiles\(|resolveTargets\(/);assert.match(pulls,/subscribe/);assert.match(pulls,/対象確認中/);
  assert.match(view,/\/api\/state/);assert.match(view,/if \(inflight\) return inflight/);assert.match(view,/data-disclosure/);
  assert.match(html,/sync-freshness/);assert.doesNotMatch(html,/summary-grid|いまの状態/);assert.match(css,/repeat\(3,minmax\(0,1fr\)\)/);
});
