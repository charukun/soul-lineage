import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostClock} from '../src/game/host-clock.js';
test('throttled host callbacks advance the same simulation time',()=>{
 const run=times=>{let elapsed=0,count=0;const advance=createHostClock(dt=>{elapsed+=dt;count++;return count;},0);for(const time of times)advance(time);return {elapsed,count};};
 const regular=run(Array.from({length:300},(_,i)=>(i+1)*1000/30));
 const throttled=run(Array.from({length:10},(_,i)=>(i+1)*1000));
 assert.deepEqual(throttled,regular);assert.equal(regular.count,300);
});
test('suspension and invalid clock readings cannot produce an unbounded catchup',()=>{
 let ticks=0;const advance=createHostClock(()=>++ticks,0);
 advance(NaN);advance(-1);assert.equal(ticks,0);
 advance(60000);assert.equal(ticks,60);advance(60000);assert.equal(ticks,60);
});
