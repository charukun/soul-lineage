import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rescueView, collectRescue } from '../ops-board/rescue.mjs';
import { rescueFixture } from './fixtures/integration-rescue-state.mjs';
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
