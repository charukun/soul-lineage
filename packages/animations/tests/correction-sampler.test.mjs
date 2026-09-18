import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorrectionSampler } from '../src/index.js';
const offset = value => Object.fromEntries(['left', 'right'].map(side => [side, { hand: [value, 0, 0], elbow: [0, value, 0], twist: value }]));

test('correction-only window softens a branch switch and retains a constant solution', () => {
  const sampler=createCorrectionSampler({duration:2,evaluate:t=>offset(t<1?0:1)});
  assert.equal(sampler.sample(.5).right.hand[0],0);
  assert.ok(Math.abs(sampler.sample(1.5).right.hand[0]-1)<1e-12);
  const a=sampler.sample(.999),b=sampler.sample(1.001);
  assert.ok(b.right.hand[0]-a.right.hand[0]<.1);
  assert.equal(a.right.hand[0],a.right.twist);
});
test('arbitrary seeking, fractional frames and cache eviction produce the same offsets', () => {
  let calls=0;const sampler=createCorrectionSampler({duration:30,capacity:12,evaluate:t=>{calls++;return offset(Math.sin(t*12));}});
  const expected=sampler.sample(17.475);sampler.sample(17.475);assert.ok(calls<=6);
  for(const t of [30,0,14,21,11,27,3,17.1])sampler.sample(t);
  assert.ok(sampler.size<=12);assert.deepEqual(sampler.sample(17.475),expected);
  sampler.clear();assert.equal(sampler.size,0);assert.deepEqual(sampler.sample(17.475),expected);
  expected.right.hand[0]=999;assert.notEqual(sampler.sample(17.475).right.hand[0],999);
  assert.deepEqual(sampler.sample(-1),sampler.sample(0));assert.deepEqual(sampler.sample(31),sampler.sample(30));
});
test('invalid correction data cannot enter a review track', () => {
  assert.throws(()=>createCorrectionSampler({duration:30,evaluate:()=>offset(0),capacity:2}));
  const sampler=createCorrectionSampler({duration:1,evaluate:()=>offset(NaN)});
  assert.throws(()=>sampler.sample(.5));assert.throws(()=>sampler.sample(Infinity));assert.equal(sampler.size,0);
});
