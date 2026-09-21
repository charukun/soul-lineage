import test from 'node:test';
import assert from 'node:assert/strict';
import {buildActionsSummary,classifyWorkflow,classifyStep,extractMajorErrors} from '../scripts/actions-result-summary.mjs';

test('workflow and step classification stays stable',()=>{
  assert.equal(classifyWorkflow('Astra Work Validation'),'validation');
  assert.equal(classifyWorkflow('Per-App DEV Publish'),'dev_publish');
  assert.equal(classifyWorkflow('Browser Review'),'browser_review');
  assert.deepEqual(classifyStep('Run focused tests'),{test:true,build:false});
  assert.deepEqual(classifyStep('Build immutable web-dev artifact'),{test:false,build:true});
});

test('major errors are compact and deduplicated',()=>{
  const rows=extractMajorErrors('ok\nError: boom\nError: boom\nFATAL deploy failed\n');
  assert.deepEqual(rows,['Error: boom','FATAL deploy failed']);
});

test('summary aggregates validation, evidence, failures and merge decision',()=>{
  const sha='a'.repeat(40);
  const statuses=[
    {context:'astra/fast-dev-contract',state:'success',updated_at:'2026-09-22T00:00:00Z'},
    {context:'astra/focused-validation',state:'success',updated_at:'2026-09-22T00:01:00Z'},
    {context:'astra/merge-freshness',state:'success',description:'Validated head contains current develop',updated_at:'2026-09-22T00:02:00Z'},
  ];
  const runs=[
    {workflow:'Astra Work Validation',kind:'validation',run_id:10,run_attempt:1,event:'push',status:'completed',conclusion:'success',head_sha:sha,url:'u',created_at:'2026-09-22T00:00:00Z',updated_at:'2026-09-22T00:03:00Z',artifacts:[],jobs:[
      {id:1,name:'Final-head focused validation',conclusion:'success',steps:[{name:'Run focused tests',conclusion:'success'},{name:'Build metadata',conclusion:'success'}],major_errors:[]}
    ]},
    {workflow:'Browser Review',kind:'browser_review',run_id:11,run_attempt:1,event:'workflow_dispatch',status:'completed',conclusion:'failure',head_sha:sha,url:'b',created_at:'2026-09-22T00:04:00Z',updated_at:'2026-09-22T00:05:00Z',artifacts:[{id:7,name:'browser-evidence',expired:false,archive_download_url:'a'}],jobs:[
      {id:2,name:'Review',conclusion:'failure',steps:[{name:'Playwright test',conclusion:'failure'}],major_errors:['Error: screenshot mismatch']}
    ]}
  ];
  const summary=buildActionsSummary({repo:'charukun/soul-lineage',sha,develop_sha:'b'.repeat(40),develop_contained_in_head:true,compare_status:'ahead',statuses,runs,pr:{number:99,html_url:'p',state:'open',draft:true,mergeable:true,mergeable_state:'clean',head:{sha},base:{ref:'develop',sha:'b'.repeat(40)}}});
  assert.equal(summary.validation.validated_exact_head,sha);
  assert.equal(summary.test.result,'failure');
  assert.equal(summary.build.result,'success');
  assert.equal(summary.browser_review.result,'failure');
  assert.equal(summary.evidence[0].name,'browser-evidence');
  assert.deepEqual(summary.failures[0].failed_steps,['Playwright test']);
  assert.deepEqual(summary.decision.blockers,[]);
  assert.equal(summary.decision.can_mark_ready,true);
  assert.equal(summary.decision.can_merge_now,false);
});
