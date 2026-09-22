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
  assert.equal(session.lastFailure.runId,5);
  assert.equal(session.lastFailure.conclusion,'failure');
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
  assert.deepEqual(session.iterationSteps.map(step=>step.id),['observation','implementation','astraValidation','afterObservation','merge','devPublish']);
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


test('autonomous iteration ordering prioritizes problems, unobserved work, then merged work independently of publication',()=>{
  const make=(number,{state='open',draft=true,mergedAt=null,mergeSha=null,updated='2026-09-22T04:00:00Z'}={})=>({
    ...pr,number,state,draft,merged_at:mergedAt,merge_commit_sha:mergeSha,updated_at:updated,
    title:'Kuumetsu autonomous iteration '+number,
    body:'Autonomous iteration '+number+'\nBrowser-Playtest: not-required',
    head:{ref:'feat/iteration-'+number,sha:String(number).padStart(40,'0')},
    targetApps:[{id:'demon',label:'喰滅廻遊'}],
  });
  const problem=make(91,{state:'open',draft:false,updated:'2026-09-22T04:04:00Z'});
  const running=make(92,{state:'open',draft:true,updated:'2026-09-22T04:03:00Z'});
  const publishing=make(93,{state:'closed',draft:false,mergedAt:'2026-09-22T04:02:00Z',mergeSha:'9'.repeat(40),updated:'2026-09-22T04:02:00Z'});
  const complete=make(94,{state:'closed',draft:false,mergedAt:'2026-09-22T04:01:00Z',mergeSha:'8'.repeat(40),updated:'2026-09-22T04:01:00Z'});
  const runs=[
    run(6,'Astra final-head validation feat/iteration-91',problem.head.sha,'failure',{head_branch:problem.head.ref}),
    run(7,'Per-App DEV Publish',complete.merge_commit_sha,'success',{head_branch:'develop'}),
  ];
  const items=buildAutonomousIterations([complete,publishing,running,problem],runs,{limit:10});
  assert.deepEqual(items.map(item=>item.pr.number),[91,92,93,94]);
  assert.deepEqual(items.map(item=>item.status),['problem','waiting','complete','complete']);
  assert.equal(items[0].lastFailure.runId,6);
  assert.equal(items[2].publication.state,'unknown');
  assert.equal(items[3].publication.state,'done');
});


test('draft implementation exposes a live start time and exact-head validation advances the visible phase',()=>{
  const draft={...pr,state:'open',draft:true,merged_at:null,merge_commit_sha:null,created_at:'2026-09-22T05:00:00Z',updated_at:'2026-09-22T05:05:00Z'};
  let [session]=buildDevelopmentSessions([draft],[]);
  const implementation=session.steps.find(step=>step.id==='implementation');
  assert.equal(implementation.state,'running');
  assert.equal(implementation.startedAt,'2026-09-22T05:00:00Z');
  assert.equal(implementation.completedAt,null);
  assert.equal(implementation.durationMs,null);

  const validation={...run(8,'Astra final-head validation '+draft.head.ref,draft.head.sha,'success'),created_at:'2026-09-22T05:06:00Z',updated_at:'2026-09-22T05:06:30Z',head_branch:draft.head.ref};
  [session]=buildDevelopmentSessions([draft],[validation]);
  const completed=session.steps.find(step=>step.id==='implementation');
  const validating=session.steps.find(step=>step.id==='validation');
  assert.equal(completed.state,'done');
  assert.equal(completed.completedAt,'2026-09-22T05:06:00Z');
  assert.equal(completed.durationMs,360000);
  assert.equal(validating.startedAt,'2026-09-22T05:06:00Z');
  assert.equal(validating.completedAt,'2026-09-22T05:06:30Z');
});


test('open draft without an active Actions run is IDLE instead of falsely RUNNING',()=>{
  const draft={...pr,state:'open',draft:true,merged_at:null,merge_commit_sha:null,created_at:'2026-09-22T06:00:00Z',updated_at:'2026-09-22T06:04:00Z'};
  const [session]=buildDevelopmentSessions([draft],[]);
  assert.equal(session.execution.state,'idle');
  assert.equal(session.execution.label,'IDLE');
  assert.equal(session.execution.lastActivityAt,'2026-09-22T06:04:00Z');
  assert.match(session.execution.detail,/実行中の処理なし/);
});

test('execution state separates automatic repair, human-required failures and merge-ready work',()=>{
  const open={...pr,state:'open',draft:true,merged_at:null,merge_commit_sha:null,updated_at:'2026-09-22T06:10:00Z'};
  const validating={...run(10,'Astra Work Validation',head,null,{head_branch:open.head.ref}),status:'in_progress',conclusion:null,created_at:'2026-09-22T06:10:00Z',updated_at:'2026-09-22T06:10:30Z'};
  let [session]=buildDevelopmentSessions([open],[validating]);
  assert.equal(session.execution.state,'validating');

  const failed={...run(11,'Astra Work Validation',head,'failure',{head_branch:open.head.ref}),created_at:'2026-09-22T06:11:00Z',updated_at:'2026-09-22T06:11:30Z'};
  [session]=buildDevelopmentSessions([open],[failed]);
  assert.equal(session.execution.state,'repair');
  assert.equal(session.execution.label,'AUTO REPAIR');
  assert.match(session.execution.detail,/自動修復/);

  const humanFailed={...failed,conclusion:'action_required',id:13};
  [session]=buildDevelopmentSessions([open],[humanFailed]);
  assert.equal(session.execution.state,'needs-user');
  assert.equal(session.execution.label,'NEEDS USER');
  assert.match(session.execution.detail,/人の判断/);

  const ready={...open,draft:false,updated_at:'2026-09-22T06:12:00Z',body:'Browser-Playtest: not-required'};
  const passed={...run(12,'Astra Work Validation',head,'success',{head_branch:ready.head.ref}),created_at:'2026-09-22T06:12:00Z',updated_at:'2026-09-22T06:12:30Z'};
  [session]=buildDevelopmentSessions([ready],[passed]);
  assert.equal(session.execution.state,'merging');
});


test('active Draft and Ready PRs are never displaced by newer merged history',()=>{
  const oldDraft={...pr,number:1524,title:'Character Create Forge',state:'open',draft:true,merged_at:null,merge_commit_sha:null,
    created_at:'2026-09-20T00:00:00Z',updated_at:'2026-09-20T01:00:00Z',head:{ref:'feat/forge',sha:'1'.repeat(40)}};
  const ready={...pr,number:1525,title:'Long running Ready',state:'open',draft:false,merged_at:null,merge_commit_sha:null,
    created_at:'2026-09-20T00:10:00Z',updated_at:'2026-09-20T01:10:00Z',head:{ref:'feat/ready',sha:'2'.repeat(40)}};
  const closed={...pr,number:1526,title:'Closed without merge',state:'closed',draft:false,merged_at:null,merge_commit_sha:null,
    updated_at:'2026-09-23T00:30:00Z',head:{ref:'feat/closed',sha:'3'.repeat(40)}};
  const mergedRows=Array.from({length:12},(_,index)=>({
    ...pr,number:1600+index,title:'Merged '+index,state:'closed',draft:false,
    merged_at:'2026-09-23T00:'+String(index).padStart(2,'0')+':00Z',
    updated_at:'2026-09-23T00:'+String(index).padStart(2,'0')+':00Z',
    merge_commit_sha:String(index+4).repeat(40).slice(0,40),
    head:{ref:'feat/merged-'+index,sha:String(index+5).repeat(40).slice(0,40)},
  }));
  const sessions=buildDevelopmentSessions([...mergedRows,closed,oldDraft,ready],[],{limit:8});
  const numbers=sessions.map(session=>session.pr.number);
  assert.ok(numbers.includes(1524),'old Draft equivalent to #1524 remains present');
  assert.ok(numbers.includes(1525),'Ready remains present');
  assert.ok(!numbers.includes(1526),'closed unmerged PR is excluded');
  assert.equal(sessions.filter(session=>session.state==='Draft'||session.state==='Ready').length,2);
});

test('active PR count may exceed the nominal history limit without dropping any open PR',()=>{
  const opens=Array.from({length:10},(_,index)=>({
    ...pr,number:1700+index,state:'open',draft:index%2===0,merged_at:null,merge_commit_sha:null,
    updated_at:'2026-09-20T00:'+String(index).padStart(2,'0')+':00Z',
    head:{ref:'feat/open-'+index,sha:String(index+1).repeat(40).slice(0,40)},
  }));
  const sessions=buildDevelopmentSessions(opens,[],{limit:8});
  assert.equal(sessions.length,10);
  assert.deepEqual(new Set(sessions.map(session=>session.state)),new Set(['Draft','Ready']));
});
