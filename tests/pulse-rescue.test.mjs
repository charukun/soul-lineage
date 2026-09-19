import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rescueView, collectRescue } from '../ops-board/rescue.mjs';
import { rescueFixture } from './fixtures/integration-rescue-state.mjs';
import { event } from '../scripts/integration-rescue-policy.mjs';
const now=Date.parse('2026-09-13T10:00:00Z');
test('PULSE reads real claim IDs with counts, blocked dependencies, waves and delivery history',()=>{
  const view=rescueView(rescueFixture(now),now);
  assert.equal(view.counts.active,4);assert.equal(view.counts.max,6);assert.equal(view.counts.stale,1);
  assert.equal(view.counts.blocked,1);assert.equal(view.counts.manual,1);assert.equal(view.counts.retry,1);
  assert.equal(view.workers.find(r=>r.pr===124).workerId,'1400/pr-124/a1');
  assert.deepEqual(view.queue.find(r=>r.pr===125).blockedBy,[120]);
  assert.equal(view.waves[0].waiting[0].pr,125);assert.ok(view.recent.some(r=>r.pr===118&&r.state==='MERGED'));
  assert.deepEqual(view.throughput,{rescued:2,merged:1,manual:0,retrying:1,windowHours:24,retainedEvents:5});
  assert.ok(view.activity.some(e=>e.action.includes('Recovered by')));
});
test('normal zero queue is ALL CLEAR but absent/corrupt data never invents healthy workers',()=>{
  const empty=rescueView(rescueFixture(now,true),now);assert.equal(empty.status,'ALL_CLEAR');assert.equal(empty.counts.active,0);
  assert.equal(rescueView(null,now).status,'UNAVAILABLE');
  assert.equal(rescueView({schema:1,repository:'other/repo'},now).available,false);
});
test('heartbeat age is derived from worker evidence, not UI refresh time',()=>{
  const s=rescueFixture(now); const view=rescueView(s,now+11*60000);
  assert.equal(view.counts.stale,5);assert.equal(view.counts.active,0);
});
test('PULSE receives one low-cost snapshot and preserves older observation on errors',async()=>{
  const state=rescueFixture(now);let requests=0;
  const view=await collectRescue({get:async path=>{requests++;assert.match(path,/rescue-state\.json/);return {data:{encoding:'base64',content:Buffer.from(JSON.stringify(state)).toString('base64')}};}},null,now);
  assert.equal(requests,1);assert.equal(view.counts.active,4);
  const failed=await collectRescue({get:async()=>{throw new Error('HTTP 429');}},view,now);
  assert.equal(failed.counts.active,4);assert.equal(failed.observationError,'HTTP 429');
});
test('public assets have no fixture route, guessed workers, or unsafe management controls',()=>{
  const source=readFileSync('ops-board/public/rescue-board.js','utf8');
  assert.doesNotMatch(source,/rescueFixture|fixture=|FORCE MERGE|SKIP VALIDATION|api\.github\.com|innerHTML/);
  assert.match(source,/record\.workerId/);assert.match(source,/record\.currentAction/);assert.match(source,/record\.blockedBy/);
  assert.match(source,/preserveView/);
});
test('ordinary attempt-zero merge and DEV observations never become Rescue throughput',()=>{
  const s=rescueFixture(now), r=s.records[118];
  Object.assign(r,{attempt:0,rescueId:null,claimedBy:null,state:'DEV',devAt:new Date(now-5000).toISOString()});
  event(s,r,'DEV','DEV observed',now-5000);
  const original=JSON.stringify(s), view=rescueView(s,now);
  assert.equal(view.throughput.rescued,1);assert.equal(view.throughput.merged,0);
  assert.deepEqual(view.observed,{merged:1,dev:1});
  assert.equal(view.recent.find(r=>r.pr===118).deliveryKind,'observed');
  assert.equal(JSON.stringify(s),original,'collector must not rewrite GitHub history');
});
test('reevaluation and staged commits are visible without implying repair push or completed waves',()=>{
  const s=rescueFixture(now), r=s.records[119];
  r.mode='reevaluate';
  const staged=s.records[118];Object.assign(staged,{state:'AWAITING_PUSH',pushedSha:null,pushedAt:null,returnedAt:null,stagedSha:'a'.repeat(40)});
  s.waves.push({id:'finished',completedAt:new Date(now).toISOString(),prs:[118,119],rescueIds:[r.rescueId,staged.rescueId],returned:[118,119]});
  const view=rescueView(s,now);
  assert.equal(view.throughput.rescued,0);assert.equal(view.throughput.merged,0);
  assert.equal(view.counts.awaitingPush,1);assert.equal(view.counts.returned,1);
  assert.equal(view.recent.find(r=>r.pr===118).deliveryKind,'staged');
  assert.equal(view.recent.find(r=>r.pr===119).deliveryKind,'reevaluated');
  assert.equal(view.waves[0].repaired,0);assert.equal(view.waves[0].returnedCount,1);
});
test('repair counts require exact pushed-head validation and the matching retained claim',()=>{
  for(const mutate of [r=>r.validation.head='a'.repeat(40),r=>r.validation.status='failed',r=>r.pushedAt=null,
    r=>r.claimedAt=new Date(now).toISOString(),r=>r.claimedBy='another-worker',r=>r.rescueId='another-attempt']){
    const s=rescueFixture(now);mutate(s.records[118]);
    const view=rescueView(s,now);assert.equal(view.throughput.rescued,1);assert.equal(view.throughput.merged,0);
  }
});
test('old or future events and missing claim history do not manufacture recent repair success',()=>{
  const s=rescueFixture(now);s.activity.forEach(e=>e.at=new Date(now+1000).toISOString());
  assert.equal(rescueView(s,now).throughput.rescued,0);
  s.activity.forEach(e=>e.at=new Date(now-86400001).toISOString());
  assert.equal(rescueView(s,now).throughput.rescued,0);
  const legacy=rescueFixture(now);delete legacy.records[118];
  assert.equal(rescueView(legacy,now).throughput.merged,0);
});
test('wave repair counts use retained evidence beyond the twenty-card display limit',()=>{
  const s=rescueFixture(now), r=s.records[118];
  s.waves.push({id:'finished',prs:[118],rescueIds:[r.rescueId],returned:[]});
  r.updatedAt=new Date(now-3600000).toISOString();
  for(let pr=200;pr<225;pr++)s.records[pr]={...r,pr,attempt:0,rescueId:null,updatedAt:new Date(now).toISOString()};
  const view=rescueView(s,now);assert.equal(view.recent.some(r=>r.pr===118),false);assert.equal(view.waves[0].repaired,1);
});
