import test from 'node:test';
import assert from 'node:assert/strict';
import {clarityScenarios} from '../scripts/browser/public-clarity.mjs';
import {readFileSync} from 'node:fs';
import {currentPrRepair} from '../scripts/browser-repair-state.mjs';

test('public DEV keeps independent construction/persistence and resident-observation gates',()=>{
  const target=(app,environment='dev')=>({app,path:`${environment}/${app}`,version:{environment}});
  const scenarios=clarityScenarios([target('village'),target('rinne'),target('demon'),target('village','prod')]);
  assert.deepEqual(scenarios.map(t=>[t.app,t.scenario]),[['village','build'],['village','director'],['rinne',undefined],['demon',undefined]]);
});

test('CI repair outcomes dispatch the registered trusted recorder and do not swallow missing routes',async()=>{
  const deploy=readFileSync(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8').split('  repair-ticket:')[1].split('  integrate:')[0];
  assert.match(deploy,/ref: develop/);assert.doesNotMatch(deploy,/ref:.*inputs.repair_head_sha/);
  const source=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  const script=source.split('  browser-repair-dispatch:')[1].split('  integration-request:')[0].split('          script: |\n')[1];
  const execute=new Function('github','context','core','process',`return (async()=>{${script}})()`);
  for(const outcome of ['failure','success']){
    const calls=[],env={CONCLUSION:outcome,HEAD_SHA:'current',PR_NUMBER:'138',ARTIFACT:'exact-head-evidence'};
    const github={rest:{repos:{getContent:async()=>({})},actions:{createWorkflowDispatch:async args=>calls.push(args)}}};
    await execute(github,{repo:{owner:'charukun',repo:'soul-lineage'},serverUrl:'https://github.com',runId:10},{notice:()=>{}},{env});
    assert.equal(calls.length,1);assert.equal(calls[0].workflow_id,'deploy.yml');assert.equal(calls[0].ref,'develop');
    assert.equal(calls[0].inputs.repair_scope,'pr');assert.equal(calls[0].inputs.repair_conclusion,outcome);assert.equal(calls[0].inputs.repair_head_sha,'current');
    github.rest.actions.createWorkflowDispatch=async()=>{throw Object.assign(new Error('missing registered route'),{status:404});};
    await assert.rejects(execute(github,{repo:{}},{notice:()=>{}},{env}),/missing registered route/);
  }
});

test('superseded, closed and unrelated PR outcomes cannot mutate repair tickets',()=>{
  const pr={state:'open',base:{ref:'develop'},head:{sha:'current'}};
  assert.equal(currentPrRepair(pr,'current'),true);
  for(const changed of [null,{...pr,state:'closed'},{...pr,base:{ref:'main'}},{...pr,head:{sha:'new'}}])assert.equal(currentPrRepair(changed,'current'),false);
});
