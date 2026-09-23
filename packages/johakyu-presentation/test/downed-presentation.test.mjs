import test from 'node:test';
import assert from 'node:assert/strict';
import {activateSampledDownedAction,downedPresentationSample} from '../src/downed-presentation.js';

test('downed pose sampling follows canonical settling progress instead of free-running clip time',()=>{
 const quarter=downedPresentationSample({downed:true,downedState:{phase:'settling',progress:.25}},2.4);
 assert.equal(quarter.progress,.25);assert.equal(quarter.time,.6);assert.equal(quarter.settled,false);
 const settled=downedPresentationSample({downed:true,downedState:{phase:'settled',progress:1}},2.4);
 assert.equal(settled.progress,1);assert.ok(settled.time>2.39&&settled.time<2.4);assert.equal(settled.settled,true);
});

test('sampled downed action bypasses fade weights so the fall pose is visible immediately',()=>{
 const calls=[],action={enabled:false,clampWhenFinished:false,paused:false,reset(){calls.push('reset');return this;},setEffectiveWeight(value){calls.push(['weight',value]);this.weight=value;return this;},setEffectiveTimeScale(value){calls.push(['timeScale',value]);return this;},play(){calls.push('play');return this;}};
 const mixer={stopAllAction(){calls.push('stopAll');}};
 assert.equal(activateSampledDownedAction(mixer,action),true);assert.deepEqual(calls[0],'stopAll');assert.equal(action.weight,1);assert.equal(action.enabled,true);assert.equal(action.paused,true);assert.equal(action.clampWhenFinished,true);assert.ok(calls.includes('play'));
});
