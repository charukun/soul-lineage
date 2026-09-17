import assert from 'node:assert/strict';
import test from 'node:test';
import {retireLegacyTutorialAfterFirstRun} from '../src/game/onboarding-coherence.js';

test('legacy tutorial is retired only after the richer first-run guide is seen',()=>{
  const state={tutorial:{dismissed:false}};
  assert.equal(retireLegacyTutorialAfterFirstRun(state,{seen:false}),false);
  assert.equal(state.tutorial.dismissed,false);
  assert.equal(retireLegacyTutorialAfterFirstRun(state,{seen:true}),true);
  assert.equal(state.tutorial.dismissed,true);
  assert.equal(retireLegacyTutorialAfterFirstRun(state,{seen:true}),false);
});

test('missing tutorial state is created when first-run completion is recorded',()=>{
  const state={};
  assert.equal(retireLegacyTutorialAfterFirstRun(state,{seen:true}),true);
  assert.deepEqual(state.tutorial,{dismissed:true});
});
