import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostClock,advanceAcceleratedFrame} from '../src/game/host-clock.js';
test('throttled host callbacks advance the same simulation time',()=>{
 const run=times=>{let elapsed=0,count=0;const advance=createHostClock(dt=>{elapsed+=dt;count++;return count;},0);for(const time of times)advance(time);return {elapsed,count};};
 const regular=run(Array.from({length:300},(_,i)=>(i+1)*1000/30));
 const throttled=run(Array.from({length:10},(_,i)=>(i+1)*1000));
 assert.deepEqual(throttled,regular);assert.equal(regular.count,300);
});
test('suspension and invalid clock readings cannot produce an unbounded catchup',()=>{
 let ticks=0;const advance=createHostClock(()=>++ticks,0);
 advance(NaN);advance(-1);assert.equal(ticks,0);
 advance(60000);assert.equal(ticks,60);advance(60000);assert.equal(ticks,60);const recovered=createHostClock(()=>++ticks,NaN);recovered(1000);recovered(1000+1000/30);assert.equal(ticks,61,'invalid start sample must recover on the first valid timestamp');
});

test('accelerated frames preserve requested world time with bounded work',()=>{
 for(const delta of [1/3,2/3,5]){let elapsed=0,calls=0;const slices=advanceAcceleratedFrame(delta,dt=>{elapsed+=dt;calls++;});assert.ok(Math.abs(elapsed-delta)<1e-9);assert.equal(calls,slices);assert.ok(calls<=8);}
});
