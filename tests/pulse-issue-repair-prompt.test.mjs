import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssueRepairPrompt, issueRepairPayload } from '../ops-board/public/issue-repair-prompt.js';

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
