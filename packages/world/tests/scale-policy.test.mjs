import test from 'node:test';
import assert from 'node:assert/strict';
import {planWorldScale,worldScaleTier,summarizeWorldScale} from '../src/scale-policy.js';

test('world scale tiers preserve local/combat importance and thin distance budgets',()=>{
 assert.equal(worldScaleTier(500,{local:true}).id,'near');
 assert.equal(worldScaleTier(500,{combat:true}).id,'near');
 assert.equal(worldScaleTier(10).id,'near');
 assert.equal(worldScaleTier(40).id,'mid');
 assert.equal(worldScaleTier(80).id,'far');
 assert.equal(worldScaleTier(150).id,'distant');
 assert.equal(worldScaleTier(300).id,'dormant');
});

test('one plan drives crowd network and audio budgets deterministically',()=>{
 const input={focus:{x:0,z:0},qualityLevel:0,entities:[{id:'a',x:3,z:4},{id:'b',x:40,z:0},{id:'c',x:100,z:0}]};
 const a=planWorldScale(input),b=planWorldScale(structuredClone(input));assert.deepEqual(a,b);
 assert.equal(a[0].crowdMode,'master');assert.equal(a[0].networkHz,20);assert.equal(a[0].audioMode,'spatial');
 assert.equal(a[2].tier,'distant');assert.equal(a[2].networkHz,.5);assert.equal(a[2].audioMode,'ambience');
 assert.equal(summarizeWorldScale(a).total,3);
});
