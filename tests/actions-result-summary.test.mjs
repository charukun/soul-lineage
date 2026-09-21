import test from 'node:test';
import assert from 'node:assert/strict';
import {
  affectedTestPlan,
  buildActionsSummary,
  browserEvidenceSummary,
  classifyWorkflow,
  classifyStep,
  devPublishReceipts,
  extractMajorErrors,
  failureDigest,
  parseValidationDirectives,
  resolveFreshness,
  mergeWindowToken,
} from '../scripts/lib/actions-summary-core.mjs';

test('workflow and step classification stays stable',()=>{
  assert.equal(classifyWorkflow('Astra Work Validation'),'validation');
  assert.equal(classifyWorkflow('Per-App DEV Publish'),'dev_publish');
  assert.equal(classifyWorkflow('Browser Review'),'browser_review');
  assert.deepEqual(classifyStep('Run focused tests'),{test:true,build:false,browser:false,publish:false});
  assert.deepEqual(classifyStep('Build immutable web-dev artifact'),{test:false,build:true,browser:false,publish:false});
  assert.equal(classifyStep('Playwright browser smoke').browser,true);
});

test('major errors and commit validation directives are compact',()=>{
  const rows=extractMajorErrors('ok\nError: boom\nError: boom\nFATAL deploy failed\n');
  assert.deepEqual(rows,['Error: boom','FATAL deploy failed']);
  assert.deepEqual(parseValidationDirectives('[astra-validate]\nAstra-Check: scripts/x.mjs\nAstra-Test: tests/x.test.mjs'),{
    none:false,checks:['scripts/x.mjs'],tests:['tests/x.test.mjs'],builds:[],source:'commit-message',
  });
});

test('freshness resolver distinguishes independent drift from reconciliation',()=>{
  const sha='a'.repeat(40),base='b'.repeat(40),develop='c'.repeat(40);
  const independent=resolveFreshness({
    sha,latestDevelopSha:develop,validationBaseSha:base,pr:{mergeable:true,mergeable_state:'clean'},
    workScope:{paths:['apps/rinne/a.js'],apps:['rinne'],packages:[],infrastructure:false,control_plane:false},
    driftScope:{paths:['apps/village/b.js'],apps:['village'],packages:[],infrastructure:false,control_plane:false},
    developContainedInHead:false,compareStatus:'diverged',
  });
  assert.equal(independent.independent_drift,true);
  assert.equal(independent.reconcile_required,false);
  assert.equal(independent.revalidation_required,false);

  const overlap=resolveFreshness({
    sha,latestDevelopSha:develop,validationBaseSha:base,pr:{mergeable:true,mergeable_state:'clean'},
    workScope:{paths:['apps/rinne/a.js'],apps:['rinne'],packages:[],infrastructure:false,control_plane:false},
    driftScope:{paths:['apps/rinne/b.js'],apps:['rinne'],packages:[],infrastructure:false,control_plane:false},
    developContainedInHead:false,compareStatus:'diverged',
  });
  assert.equal(overlap.reconcile_required,true);
  assert.equal(overlap.revalidation_required,true);
  assert.deepEqual(overlap.affected_scope_overlap.apps,['rinne']);
});

test('affected test planner is advisory and keeps heavy candidates separate',()=>{
  const plan=affectedTestPlan({
    paths:['scripts/thing.mjs','tests/thing.test.mjs','tests/browser-smoke.test.mjs'],
    scope:{apps:['rinne']},
    testsIndex:['tests/thing.test.mjs','tests/browser-smoke.test.mjs'],
  });
  assert.ok(plan.recommended_directives.includes('Astra-Check: scripts/thing.mjs'));
  assert.ok(plan.recommended_directives.includes('Astra-Test: tests/thing.test.mjs'));
  assert.ok(!plan.recommended_directives.some(row=>row.includes('browser-smoke')));
  assert.deepEqual(plan.heavy_test_candidates,['tests/browser-smoke.test.mjs']);
  assert.deepEqual(plan.build_candidates,['rinne']);
});

test('failure digest classifies transient and source-repair failures without changing gates',()=>{
  const rows=failureDigest([
    {workflow:'Astra',run_id:1,url:'u',jobs:[
      {id:10,name:'Validate',conclusion:'failure',steps:[{name:'Run tests',conclusion:'failure'}],major_errors:['AssertionError: expected 1']},
      {id:11,name:'Install',conclusion:'timed_out',steps:[],major_errors:['network timeout']},
    ]},
  ]);
  assert.equal(rows[0].probable_scope,'test');
  assert.equal(rows[0].repairable,true);
  assert.equal(rows[1].retryable,true);
});

test('DEV publish and browser evidence receipts use existing logs and artifacts',()=>{
  const sha='d'.repeat(40);
  const runs=[
    {workflow:'Per-App DEV Publish',kind:'dev_publish',run_id:20,head_sha:sha,conclusion:'success',jobs:[
      {id:2,name:'Publish rinne DEV',conclusion:'success',steps:[
        {name:'Publish exact app artifact',conclusion:'success'},
        {name:'Diagnose public app source',conclusion:'success'},
      ],diagnostic_log:'Current Version ID: 12345678-1234-1234-1234-123456789abc\nhttps://soul-lineage-rinne-dev.c-okamoto.workers.dev/'},
    ]},
    {workflow:'PR Checks',kind:'validation',run_id:21,head_sha:sha,conclusion:'success',jobs:[
      {id:3,name:'Affected browser smoke',conclusion:'success',steps:[{name:'Playwright browser smoke',conclusion:'success'}],
       diagnostic_log:'WebGL renderer: swiftshader\np50=8ms p95=17ms p99=28ms\nassertions passed'},
    ]},
  ];
  const receipts=devPublishReceipts(runs,[{context:'dev/rinne',state:'success',target_url:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/'}]);
  assert.equal(receipts[0].worker_version_id,'12345678-1234-1234-1234-123456789abc');
  assert.equal(receipts[0].immutable_preview_url,'https://12345678-soul-lineage-rinne-dev.c-okamoto.workers.dev/');
  assert.equal(receipts[0].immutable_preview_source,'derived-from-version-id');
  assert.equal(receipts[0].version_verification,'success');
  const browser=browserEvidenceSummary(runs,[{type:'trace',artifact_url:'trace-url'}]);
  assert.equal(browser.result,'success');
  assert.equal(browser.performance.p95.value,17);
  assert.ok(browser.webgl.some(line=>line.includes('WebGL')));
  assert.deepEqual(browser.evidence_urls,['trace-url']);
});

test('summary exposes one Fast DEV session JSON including exact head, ready snapshot and merge receipt',()=>{
  const head='a'.repeat(40),merge='f'.repeat(40),base='b'.repeat(40);
  const statuses=[
    {context:'astra/fast-dev-contract',state:'success',updated_at:'2026-09-22T00:00:00Z'},
    {context:'astra/focused-validation',state:'success',updated_at:'2026-09-22T00:01:00Z'},
    {context:'astra/merge-freshness',state:'success',updated_at:'2026-09-22T00:02:00Z'},
  ];
  const runs=[
    {workflow:'Astra Work Validation',kind:'validation',run_id:10,run_attempt:1,event:'push',status:'completed',conclusion:'success',head_sha:head,url:'u',created_at:'2026-09-22T00:00:00Z',updated_at:'2026-09-22T00:03:00Z',artifacts:[],jobs:[
      {id:1,name:'Final-head focused validation',conclusion:'success',steps:[{name:'Run focused tests',conclusion:'success'}],major_errors:[]}
    ]},
    {workflow:'Per-App DEV Publish',kind:'dev_publish',run_id:12,run_attempt:1,event:'push',status:'completed',conclusion:'success',head_sha:merge,url:'d',created_at:'2026-09-22T00:04:00Z',updated_at:'2026-09-22T00:05:00Z',artifacts:[],jobs:[
      {id:2,name:'Publish rinne DEV',conclusion:'success',steps:[{name:'Diagnose public app source',conclusion:'success'}],major_errors:[],diagnostic_log:'Current Version ID: abcdef12'}
    ]},
  ];
  const pr={number:99,html_url:'p',state:'closed',draft:false,merged_at:'2026-09-22T00:04:00Z',merge_commit_sha:merge,mergeable:true,mergeable_state:'clean',labels:[],body:'',head:{sha:head},base:{ref:'develop',sha:base}};
  const freshness={result:'fresh',validation_base_sha:base,revalidation_required:false};
  const summary=buildActionsSummary({
    repo:'charukun/soul-lineage',sha:merge,validation_sha:head,statuses,runs,pr,freshness,
    required_validation:{none:false,checks:['scripts/x.mjs'],tests:[],builds:[],source:'commit-message'},
    required_evidence:{browser:{required:false}},
    session_manifest:{base_sha:base,head_sha:head,pr:{number:99},affected_scope:{apps:['rinne'],packages:[]}},
    test_plan:{advisory:true},
  });
  assert.equal(summary.schema,'soul-lineage.fast-dev-session.v2');
  assert.equal(summary.exact_head_gate.validated_exact_head,head);
  assert.equal(summary.exact_head_gate.matches,true);
  assert.equal(summary.merge_receipt.merge_commit,merge);
  assert.deepEqual(summary.merge_receipt.related_dev_publish_run_ids,[12]);
  assert.equal(summary.decision.merged_to_develop,true);
  assert.ok(summary.session_manifest);
  assert.ok(summary.failure_digest);
  assert.ok(summary.artifact_index);
  assert.equal(summary.validation_entry.reconcile_before_validation,false);
});

test('summary surfaces related develop drift before final validation is armed',()=>{
  const freshness={
    result:'reconcile-required',latest_develop_sha:'c'.repeat(40),validation_base_sha:'b'.repeat(40),
    develop_contained_in_head:false,reconcile_required:true,revalidation_required:true,independent_drift:false,
  };
  const summary=buildActionsSummary({
    repo:'charukun/soul-lineage',sha:'a'.repeat(40),validation_sha:'a'.repeat(40),statuses:[],runs:[],
    pr:{number:7,state:'open',draft:true,mergeable:true,mergeable_state:'clean',labels:[],body:'',head:{sha:'a'.repeat(40)},base:{ref:'develop',sha:'b'.repeat(40)}},
    freshness,required_validation:{none:true,checks:[],tests:[],builds:[],source:'commit-message'},
    required_evidence:{browser:{required:false}},session_manifest:{affected_scope:{apps:['demon'],packages:[]}},test_plan:{advisory:true},
  });
  assert.equal(summary.validation_entry.develop_drift_detected,true);
  assert.equal(summary.validation_entry.reconcile_before_validation,true);
  assert.equal(summary.validation_entry.action,'reconcile-before-final-validation');
});


test('merge window token binds the validated head to the develop SHA observed after Ready',()=>{
  const head='a'.repeat(40),develop='b'.repeat(40);
  const armed=mergeWindowToken({validatedHead:head,developSha:develop,prHead:head});
  assert.equal(armed.armed,true);
  assert.equal(armed.token,`${head}:${develop}`);
  assert.equal(armed.reread_after_ready_required,true);
  const moved=mergeWindowToken({validatedHead:head,developSha:develop,prHead:'c'.repeat(40)});
  assert.equal(moved.armed,false);
  assert.equal(moved.token,null);
});
