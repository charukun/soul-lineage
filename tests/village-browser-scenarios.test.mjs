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

test('normal CI omits browser repair dispatch while explicit legacy repair recording stays isolated',()=>{
  const deploy=readFileSync(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8').split('  repair-ticket:')[1].split('  integrate:')[0];
  assert.match(deploy,/name: Record explicit legacy PR browser repair state/);
  assert.match(deploy,/github\.event_name == 'workflow_dispatch' && inputs\.repair_scope == 'pr'/);
  assert.match(deploy,/ref: develop/);
  assert.doesNotMatch(deploy,/ref:.*inputs\.repair_head_sha/);
  const source=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.doesNotMatch(source,/browser-repair-dispatch:/);
  assert.doesNotMatch(source,/repair_scope:\s*'pr'/);
  assert.doesNotMatch(source,/Affected browser smoke/);
});

test('superseded, closed and unrelated PR outcomes cannot mutate repair tickets',()=>{
  const pr={state:'open',base:{ref:'develop'},head:{sha:'current'}};
  assert.equal(currentPrRepair(pr,'current'),true);
  for(const changed of [null,{...pr,state:'closed'},{...pr,base:{ref:'main'}},{...pr,head:{sha:'new'}}])assert.equal(currentPrRepair(changed,'current'),false);
});
