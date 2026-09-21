import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEvidenceRelations,valueAt} from '../scripts/autonomous-evidence.mjs';

test('same-state evidence uses authoritative relations instead of fixed procedural values',()=>{
  const state={
    view:{displayedMeals:2,text:'今回の狩り 捕食 2\n未確保の戦利品 5 · 帰還で確保'},
    profile:{currentLife:{eaten:0}},
    hunt:{eaten:2,carried:5},
  };
  const checked=evaluateEvidenceRelations({state,relations:[
    {id:'live-meals','type':'sumEquals',target:'state.view.displayedMeals',terms:['state.profile.currentLife.eaten','state.hunt.eaten']},
    {id:'carried','type':'textIncludesValue',text:'state.view.text',value:'state.hunt.carried',prefix:'未確保の戦利品 ',suffix:' · 帰還で確保'},
  ]});
  assert.equal(checked.supported,true);
  assert.equal(checked.results[1].expected,'未確保の戦利品 5 · 帰還で確保');
});

test('unchanged relation guards read-only views and reports falsifiers',()=>{
  const before={profile:{eaten:0,powers:['heat']},hunt:{carried:7}};
  const after={profile:{eaten:0,powers:['heat']},hunt:{carried:7}};
  const pass=evaluateEvidenceRelations({before,after,relations:[
    {id:'profile-read-only','type':'unchanged',left:'before.profile',right:'after.profile'},
    {id:'hunt-read-only','type':'equals',left:'before.hunt',right:'after.hunt'},
  ]});
  assert.equal(pass.supported,true);
  after.hunt={carried:8};
  const fail=evaluateEvidenceRelations({before,after,relations:[
    {id:'hunt-read-only','type':'unchanged',left:'before.hunt',right:'after.hunt'},
  ]});
  assert.equal(fail.supported,false);
  assert.deepEqual(fail.results[0].actual,{carried:7});
  assert.deepEqual(fail.results[0].expected,{carried:8});
});

test('path reader fails closed on missing evidence coordinates',()=>{
  assert.equal(valueAt({a:{b:3}},'a.b'),3);
  assert.throws(()=>valueAt({a:{}},'a.b'),/missing evidence path/);
});
