import test from 'node:test';
import assert from 'node:assert/strict';
import {activateSampledDownedAction,downedPresentationSample,terminalPresentationState} from '../src/downed-presentation.js';

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

test('terminal presentation separates falling, settled ground pose and executed corpse',()=>{
 const falling=terminalPresentationState({downed:true,dead:false,downedState:{phase:'settling',progress:.4}},'enemy');assert.deepEqual(falling,{downed:true,dead:false,settled:false,clip:'Lie_Down',removalClock:false});
 const settled=terminalPresentationState({downed:true,dead:false,downedState:{phase:'settled',progress:1}},'enemy');assert.deepEqual(settled,{downed:true,dead:false,settled:true,clip:'Lie_Pose',removalClock:false});
 const executed=terminalPresentationState({downed:true,dead:true},'enemy');assert.deepEqual(executed,{downed:true,dead:true,settled:true,clip:'Lie_Pose',removalClock:true});
 const deadOnly=terminalPresentationState({downed:false,dead:true},'enemy');assert.deepEqual(deadOnly,{downed:false,dead:true,settled:false,clip:'Death_C_Skeletons',removalClock:true});
});
