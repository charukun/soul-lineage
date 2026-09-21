import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord,REPOSITORY} from '../.autonomous/lib/contract.mjs';

const SHA='1'.repeat(40);
const base=()=>({
  schemaVersion:3,
  id:'dense-gameplay-synthetic',
  game:'kuumetsu',
  mode:'evolution',
  kind:'gameplay',
  themeKey:'retreat-decision',
  experienceGoal:{
    playerProblem:'The player cannot judge whether to keep hunting or return.',
    targetState:'The player can compare current gain and current risk before choosing to continue or return.',
    successSignals:['current gain is visible','current risk and return consequence are visible']
  },
  rootCauses:[
    {key:'gain-feedback',summary:'gain is split across surfaces',prediction:'unify live gain',falsifier:'gain remains unreadable',paths:['apps/demon/src/web/main.js']},
    {key:'return-feedback',summary:'return consequence is not connected',prediction:'connect consequence to return choice',falsifier:'return remains ambiguous',paths:['apps/demon/src/web/main.js']}
  ],
  workItems:[
    {id:'show-live-gain',summary:'show authoritative live gain',rootCauseKeys:['gain-feedback'],paths:['apps/demon/src/web/main.js'],evidence:'live gain relation'},
    {id:'show-return-consequence',summary:'show return consequence next to choice',rootCauseKeys:['return-feedback'],paths:['apps/demon/src/web/main.js'],evidence:'return consequence relation'}
  ],
  observation:{
    summary:'immutable observation',
    staging:{kind:'immutable-staging',sourceSha:SHA,reference:'https://example.invalid/',observedAt:'2026-09-22T00:00:00Z',conditions:{scenario:'native hunt'},notVerified:[]},
    evidence:[{kind:'source',revision:SHA,path:'apps/demon/src/web/main.js',symbol:'render',statement:'two connected player decisions are missing'}]
  },
  hypothesis:{cause:'decision inputs are disconnected',prediction:'player can evaluate return tradeoff',falsifier:'decision remains ambiguous'},
  candidates:[{id:'decision-bundle',selected:true,reason:'closes the player problem'},{id:'copy-only',selected:false,reason:'does not connect authoritative state'}],
  implementation:{paths:['apps/demon/src/web/main.js'],summary:'connect gain and return consequence'},
  evidencePlan:{
    objective:'reproducible-causality',
    focusedTests:['apps/demon/tests/hunt-loop-native.test.mjs'],
    stagingAfter:'required',
    limitations:['synthetic fixture'],
    workItemCoverage:[
      {workItemId:'show-live-gain',evidence:'native assertion compares visible gain to authoritative state'},
      {workItemId:'show-return-consequence',evidence:'native assertion verifies consequence beside return choice'}
    ]
  },
  receipt:{repository:REPOSITORY,pullRequest:123,marker:'autonomous-receipt:kuumetsu:dense-gameplay-synthetic'}
});

test('v3 accepts a dense gameplay theme with multiple causal work items',()=>{
  assert.equal(validateRecord(base()),true);
});

test('v3 rejects gameplay iterations that collapse to one work item without observed exception evidence',()=>{
  const row=base();
  row.workItems=row.workItems.slice(0,1);
  row.evidencePlan.workItemCoverage=row.evidencePlan.workItemCoverage.slice(0,1);
  assert.throws(()=>validateRecord(row),/requires at least two work items/);
});

test('v3 permits a genuinely atomic gameplay fix only with an evidence-linked exception',()=>{
  const row=base();
  row.workItems=row.workItems.slice(0,1);
  row.evidencePlan.workItemCoverage=row.evidencePlan.workItemCoverage.slice(0,1);
  row.singleFixException={reason:'protected-rule-risk',evidence:'two connected player decisions are missing'};
  assert.equal(validateRecord(row),true);
});

test('v3 rejects padding with unknown root causes or uncovered work items',()=>{
  const unknown=base();
  unknown.workItems[1].rootCauseKeys=['invented-root'];
  assert.throws(()=>validateRecord(unknown),/known root causes/);
  const uncovered=base();
  uncovered.evidencePlan.workItemCoverage=uncovered.evidencePlan.workItemCoverage.slice(0,1);
  assert.throws(()=>validateRecord(uncovered),/cover every work item/);
});
