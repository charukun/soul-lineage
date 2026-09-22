import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssueRepairPrompt, buildIterationRepairPrompt, issueRepairPayload, iterationRepairPayload } from '../ops-board/public/issue-repair-prompt.js';

const state={
  generatedAt:'2026-09-22T05:00:00+09:00',
  syncStatus:'ok',
  environments:[{id:'dev',branchCommit:'d'.repeat(40)}],
  developmentSessions:[{
    pr:{number:1351,url:'https://github.com/charukun/soul-lineage/pull/1351'},
    title:'PULSE repair',state:'Ready',status:'problem',branch:'feat/pulse',
    headSha:'a'.repeat(40),validatedExactHead:null,mergeSha:null,repairAttempts:2,
    targets:[{id:'ops-board',label:'PULSE'}],
    steps:[{id:'validation',runId:123,url:'https://github.com/charukun/soul-lineage/actions/runs/123'}],
  }],
};
const issue={type:'action-failed',tone:'danger',title:'Astra validation failed',detail:'focused test failure',url:'https://github.com/charukun/soul-lineage/actions/runs/123',since:'2026-09-22T04:59:00+09:00'};

test('issue repair prompt carries exact current evidence but requires GitHub revalidation before action',()=>{
  const payload=issueRepairPayload(issue,state);
  assert.equal(payload.developSha,'d'.repeat(40));
  assert.equal(payload.session.prNumber,1351);
  assert.equal(payload.session.repairAttempts,2);
  const prompt=buildIssueRepairPrompt(issue,state);
  assert.match(prompt,/最新develop exact SHAとAGENTS\.md/);
  assert.match(prompt,/actions:summary/);
  assert.match(prompt,/failure digest \/ exact-head \/ freshness/);
  assert.match(prompt,/既存branch \/ PRを維持/);
  assert.match(prompt,/品質gate.*弱め/);
  assert.match(prompt,/同じセッションでdevelopへmerge/);
  assert.match(prompt,/main \/ Productionは変更しない/);
  assert.match(prompt,/後続成功等で解消済みなら再実行・再修正せず/);
  assert.match(prompt,/BEGIN_PULSE_ISSUE_DATA/);
  assert.match(prompt,/#1351/);
});


test('iteration repair prompt carries run identity, failed step and last failure without trusting PULSE as authority',()=>{
  const iteration={
    id:'kuumetsu-run:2',runKey:'kuumetsu-run',game:'kuumetsu',iteration:2,iterations:3,
    title:'enemy reaction clarity',theme:'enemy reaction clarity',status:'problem',currentStep:'astraValidation',
    branch:'feat/kuumetsu-2',pr:{number:1400,url:'https://github.com/charukun/soul-lineage/pull/1400'},
    validatedHead:'b'.repeat(40),mergeSha:null,repairAttempts:2,
    steps:[{id:'astraValidation',label:'Astra',state:'problem'}],
    lastFailure:{workflow:'Astra final-head validation',conclusion:'failure',runId:456,url:'https://github.com/charukun/soul-lineage/actions/runs/456',headSha:'c'.repeat(40),at:'2026-09-22T06:00:00Z'},
  };
  const payload=iterationRepairPayload(iteration,state);
  assert.equal(payload.iteration.runKey,'kuumetsu-run');
  assert.equal(payload.iteration.iteration,2);
  assert.equal(payload.iteration.failedStep,'astraValidation');
  assert.equal(payload.iteration.lastFailure.runId,456);
  const text=buildIterationRepairPrompt(iteration,state);
  assert.match(text,/runKey: kuumetsu-run/);
  assert.match(text,/iteration: 2\/3/);
  assert.match(text,/currentStep: astraValidation/);
  assert.match(text,/failedStep: astraValidation/);
  assert.match(text,/actions:summary/);
  assert.match(text,/既存branch \/ PRを維持/);
  assert.match(text,/同じセッションでdevelopへmerge/);
  assert.match(text,/BEGIN_PULSE_ITERATION_DATA/);
});
