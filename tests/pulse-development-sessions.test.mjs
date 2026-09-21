import test from 'node:test';
import assert from 'node:assert/strict';
import { autonomousIterationMeta, buildAutonomousIterations, buildDevelopmentSessions, fastDevRunKind } from '../ops-board/development-sessions.mjs';
import { advanceIterationTelemetry, createIterationTelemetry, patchIterationTelemetry, upsertIterationTelemetry } from '../scripts/autonomous-iteration-telemetry.mjs';

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
  const meta=autonomousIterationMeta(auto);
  assert.equal(meta.kind,'autonomous');
  assert.equal(meta.game,'kuumetsu');
  assert.equal(meta.number,4);
  assert.equal(meta.observationRecorded,true);
  assert.equal(meta.telemetry,null);
  assert.equal(session.autonomous.game,'kuumetsu');
  assert.deepEqual(session.iterationSteps.map(step=>step.id),['observation','implementation','validation','after','merge','publish']);
  assert.deepEqual(session.iterationSteps.map(step=>step.state),['done','done','done','done','done','done']);
});


test('recorded telemetry makes runKey and per-step durations authoritative for parallel iteration cards',()=>{
  let telemetry=createIterationTelemetry({
    runKey:'session-three',game:'kuumetsu',iteration:2,iterations:3,sourceSha:head,
    startedAt:'2026-09-22T03:00:00Z',
  });
  telemetry=advanceIterationTelemetry(telemetry,{from:'observation',to:'investigation',at:'2026-09-22T03:00:10Z'});
  telemetry=advanceIterationTelemetry(telemetry,{from:'investigation',to:'implementation',at:'2026-09-22T03:00:22Z',patch:{theme:'risk reward clarity'}});
  telemetry=patchIterationTelemetry(telemetry,{prNumber:77,improvementSummary:'retreat value is now legible'});
  const recorded={...pr,number:77,title:'Kuumetsu iteration 2: risk reward clarity',state:'open',draft:true,merged_at:null,merge_commit_sha:null,
    body:upsertIterationTelemetry('Autonomous iteration\nBrowser-Playtest: demon',telemetry),
    targetApps:[{id:'demon',label:'喰滅廻遊'}],
  };
  const [item]=buildAutonomousIterations([recorded],[],{limit:10});
  assert.equal(item.id,'session-three:2');
  assert.equal(item.runKey,'session-three');
  assert.equal(item.iteration,2);
  assert.equal(item.iterations,3);
  assert.equal(item.theme,'risk reward clarity');
  assert.equal(item.improvementSummary,'retreat value is now legible');
  assert.equal(item.currentStep,'implementation');
  assert.equal(item.steps.find(step=>step.id==='observation').durationMs,10000);
  assert.equal(item.steps.find(step=>step.id==='investigation').durationMs,12000);
  assert.equal(item.steps.find(step=>step.id==='astraValidation').durationMs,null);
  assert.equal(item.telemetry,'recorded');
});
