import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlayback,markerAge,sampleTime} from '../src/review/playback.js';
test('seek and frame stepping work while paused and do not apply playback speed',()=>{
  const p=createPlayback();p.duration=2;p.speed=.25;p.seek(.5);p.step(1/60);
  assert.ok(Math.abs(p.time-(.5+1/60))<1e-10);assert.equal(p.playing,false);
});
test('loop and once endpoints, invalid time and speed-independent seeking',()=>{
  assert.equal(sampleTime(3,2,true),1);assert.equal(sampleTime(3,2,false),2);assert.equal(sampleTime(NaN,2),0);
  const p=createPlayback();p.duration=1;p.loop=false;p.time=.99;p.playing=true;p.update(.05);assert.equal(p.time,1);assert.equal(p.playing,false);
});
test('marker evaluation can be scrubbed backward deterministically',()=>{
  assert.ok(Math.abs(markerAge(.5,.42,2,false)-.08)<1e-9);
  assert.equal(markerAge(.2,.42,2,false),Infinity);assert.equal(markerAge(.5,3,2,true),Infinity);
});
