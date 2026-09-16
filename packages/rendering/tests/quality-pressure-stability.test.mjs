import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpuAwareQualityGovernor} from '../src/gpu-aware-quality.js';
test('village can debounce pressure-axis fluctuations without disabling sustained adaptive quality',()=>{
 const changes=[],q=createGpuAwareQualityGovernor({targetFps:60,bottleneckFrames:12,degradeFrames:999,recoverFrames:999,onChange:s=>changes.push(s.bottleneck)});
 for(let i=0;i<48;i++)q.observeFrame(i%2?.012:.026,i%2?8:4);
 assert.deepEqual(changes,['unknown']);
 for(let i=0;i<12;i++)q.observeFrame(.026,4);
 assert.equal(q.snapshot().bottleneck,'cpu');
 for(let i=0;i<12;i++)q.observeFrame(.026,22);
 assert.equal(q.snapshot().bottleneck,'gpu');assert.deepEqual(changes,['unknown','cpu','gpu']);
});
