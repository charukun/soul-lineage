import test from 'node:test';
import assert from 'node:assert/strict';
import {clarityScenarios} from '../scripts/browser/public-clarity.mjs';

test('public DEV keeps independent construction/persistence and resident-observation gates',()=>{
  const target=(app,environment='dev')=>({app,path:`${environment}/${app}`,version:{environment}});
  const scenarios=clarityScenarios([target('village'),target('rinne'),target('demon'),target('village','prod')]);
  assert.deepEqual(scenarios.map(t=>[t.app,t.scenario]),[['village','build'],['village','director'],['rinne',undefined],['demon',undefined]]);
});
