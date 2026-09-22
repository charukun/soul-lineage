import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulation} from './helpers/johakyu-simulation.mjs';
import {createJohakyuReviewRules} from '../src/nocturne/johakyu-rules.js';

test('ended review encounters have no live attack or phase beneath victory/death animation',()=>{
  const source=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
  const engine=simulation(source,{rules:createJohakyuReviewRules()});engine.init();
  let endings=0;
  for(let tick=0;tick<7200;tick++){
    engine.step(1/60);const state=engine.digest();
    if(state.game.phase!=='victory'&&state.game.phase!=='defeat')continue;
    endings++;
    assert.ok(state.actors.every(actor=>actor.attack===null));
    assert.ok(engine.observe().actors.every(actor=>actor.phase===null));
  }
  assert.ok(endings>60,'Must inspect rendered ending states, not only a callback');
});
