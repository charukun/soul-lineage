import test from 'node:test';
import assert from 'node:assert/strict';
import { autonomousIterationMeta, buildDevelopmentSessions, fastDevRunKind } from '../ops-board/development-sessions.mjs';

const head='a'.repeat(40),merge='b'.repeat(40);
const pr={number:42,title:'PULSE visual flow',body:'Browser-Playtest: demon',state:'closed',draft:false,merged_at:'2026-09-22T00:05:00Z',updated_at:'2026-09-22T00:05:00Z',html_url:'https://github.com/charukun/soul-lineage/pull/42',merge_commit_sha:merge,head:{ref:'feat/pulse',sha:head},base:{ref:'develop'},targetApps:[{id:'ops-board',label:'開発状況ボード'}]};
const run=(id,name,sha,conclusion='success',extra={})=>({id,name,display_title:extra.display_title||name,head_sha:sha,head_branch:extra.head_branch||'feat/pulse',status:'completed',conclusion,created_at:'2026-09-22T00:0'+id+':00Z',updated_at:'2026-09-22T00:0'+id+':30Z',html_url:'https://github.com/actions/'+id});

test('Fast DEV session visual receipt joins exact-head validation, browser evidence, merge and DEV publish',()=>{
  const runs=[
    run(1,'Astra final-head validation feat/pulse old','c'.repeat(40),'failure'),
    run(2,'Astra final-head validation feat/pulse '+head,head,'success'),
    run(3,'Browser Review Dispatcher','d'.repeat(40),'success',{display_title:pr.title,head_branch:'main'}),
    run(4,'Per-App DEV Publish',merge,'success',{head_branch:'develop'}),
  ];
  const [session]=buildDevelopmentSessions([pr],runs);
  assert.equal(session.status,'complete');
  assert.equal(session.validatedExactHead,head);
  assert.equal(session.repairAttempts,1);
  assert.deepEqual(session.steps.map(step=>step.state),['done','done','done','done','done']);
  assert.equal(session.targets[0].id,'ops-board');
});

test('required browser evidence remains visibly waiting and failed exact-head validation is a problem',()=>{
  const open={...pr,state:'open',draft:false,merged_at:null,merge_commit_sha:null,updated_at:'2026-09-22T01:00:00Z'};
  const runs=[run(5,'Astra final-head validation feat/pulse '+head,head,'failure')];
  const [session]=buildDevelopmentSessions([open],runs);
  assert.equal(session.status,'problem');
  assert.equal(session.steps.find(step=>step.id==='validation').state,'problem');
  assert.equal(session.steps.find(step=>step.id==='browser').state,'waiting');
  assert.equal(session.steps.find(step=>step.id==='merge').state,'waiting');
});

test('run classifier stays independent from dynamic workflow display titles',()=>{
  assert.equal(fastDevRunKind({name:'Astra final-head validation feat/x abc'}),'validation');
  assert.equal(fastDevRunKind({name:'Per-App DEV Publish'}),'publish');
  assert.equal(fastDevRunKind({name:'Browser Review Dispatcher'}),'browser');
});

test('autonomous iteration sessions expose observation through DEV as a dedicated six-stage flow',()=>{
  const auto={...pr,title:'Kuumetsu iteration 4: enemy reaction',body:'Autonomous iteration 4/4. Immutable Before: https://example.test/\nBrowser-Playtest: demon',targetApps:[{id:'demon',label:'喰滅廻遊'}]};
  const runs=[
    run(2,'Astra final-head validation feat/pulse '+head,head,'success'),
    run(3,'Browser Review Dispatcher','d'.repeat(40),'success',{display_title:auto.title,head_branch:'main'}),
    run(4,'Per-App DEV Publish',merge,'success',{head_branch:'develop'}),
  ];
  const [session]=buildDevelopmentSessions([auto],runs);
  assert.deepEqual(autonomousIterationMeta(auto),{kind:'autonomous',game:'kuumetsu',number:4,observationRecorded:true});
  assert.equal(session.autonomous.game,'kuumetsu');
  assert.deepEqual(session.iterationSteps.map(step=>step.id),['observation','implementation','validation','after','merge','publish']);
  assert.deepEqual(session.iterationSteps.map(step=>step.state),['done','done','done','done','done','done']);
});
