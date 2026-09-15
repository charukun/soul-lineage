import test from 'node:test';
import assert from 'node:assert/strict';
import {worldScaleTier} from '../packages/world/src/scale-policy.js';
import {worldScaleKernel} from '../packages/platform-web/src/world-scale-kernel.js';
import {presencePolicy} from '../packages/network/src/presence-lod.js';
import {audioLODForDistance} from '../packages/audio/src/audio-lod.js';

test('world, worker, network and audio adapters share the same distance tiers',()=>{
 for(const distance of [0,18,19,48,49,92,93,168,169,400]){
  const canonical=worldScaleTier(distance).id,worker=worldScaleKernel({focus:{x:0,z:0},entities:[{id:'x',x:distance,z:0}]})[0].tier;
  assert.equal(worker,canonical,`worker ${distance}`);assert.equal(presencePolicy(distance).tier,canonical,`network ${distance}`);assert.equal(audioLODForDistance(distance).tier,canonical,`audio ${distance}`);
 }
});
