import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,setClockRate,tickLife} from '../src/rebuild/domain.js';
import {MAX_SIMULATION_DELTA_SECONDS,splitRuntimeFrameDelta} from '../src/rebuild/runtime-clock.js';

function advanceAtFrameMs(frameMs,{seconds=60,rate=1}={}){
  const state=createLife({seed:383});setClockRate(state,rate);
  let elapsed=0;
  while(elapsed<seconds){
    const frameSeconds=Math.min(frameMs/1000,seconds-elapsed);
    const {simulationDelta,lifeDelta}=splitRuntimeFrameDelta(frameSeconds);
    tickLife(state,{realDelta:simulationDelta,lifeDelta});
    elapsed+=frameSeconds;
  }
  return state;
}

test('life clock keeps real elapsed time across 16/50/100/200ms rendering frames',()=>{
  for(const frameMs of [16,50,100,200]){
    const state=advanceAtFrameMs(frameMs);
    assert.ok(Math.abs(state.ageSeconds-60)<1e-8,`${frameMs}ms frame lost life time: ${state.ageSeconds}`);
    assert.ok(Math.abs(state.ageYears-1)<1e-10,`${frameMs}ms frame changed year contract: ${state.ageYears}`);
  }
});

test('20x world speed still reaches one year in three real seconds at low FPS',()=>{
  for(const frameMs of [16,50,100,200]){
    const state=advanceAtFrameMs(frameMs,{seconds:3,rate:20});
    assert.ok(Math.abs(state.ageSeconds-60)<1e-8,`${frameMs}ms frame changed 20x life time: ${state.ageSeconds}`);
    assert.ok(Math.abs(state.ageYears-1)<1e-10);
  }
});

test('slow frames cap simulation work without capping life elapsed time',()=>{
  const delta=splitRuntimeFrameDelta(.2);
  assert.equal(delta.simulationDelta,MAX_SIMULATION_DELTA_SECONDS);
  assert.equal(delta.lifeDelta,.2);
  const state=createLife({seed:383});setClockRate(state,20);
  tickLife(state,{realDelta:delta.simulationDelta,lifeDelta:delta.lifeDelta});
  assert.equal(state.ageSeconds,4);
  assert.equal(state.idleSeconds,MAX_SIMULATION_DELTA_SECONDS);
});

test('hidden frames advance neither simulation nor life time',()=>{
  assert.deepEqual(splitRuntimeFrameDelta(30,{paused:true}),{simulationDelta:0,lifeDelta:0});
});

test('runtime frame deltas reject invalid elapsed time',()=>{
  assert.throws(()=>splitRuntimeFrameDelta(-.001),/フレーム時間/);
  assert.throws(()=>splitRuntimeFrameDelta(Infinity),/フレーム時間/);
});
