import test from 'node:test';
import assert from 'node:assert/strict';
import {downedPresentationSample} from '../src/downed-presentation.js';

test('downed pose sampling follows canonical settling progress instead of free-running clip time',()=>{
 const quarter=downedPresentationSample({downed:true,downedState:{phase:'settling',progress:.25}},2.4);
 assert.equal(quarter.progress,.25);assert.equal(quarter.time,.6);assert.equal(quarter.settled,false);
 const settled=downedPresentationSample({downed:true,downedState:{phase:'settled',progress:1}},2.4);
 assert.equal(settled.progress,1);assert.ok(settled.time>2.39&&settled.time<2.4);assert.equal(settled.settled,true);
});
