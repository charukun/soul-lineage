import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHostCapability,rankHostCandidates,selectHostCandidate} from '../src/host-capability.js';

test('stable capable peer can outrank mayor bonus',()=>{
  const members={
    old:{connected:true,eligible:true,joinOrder:0},
    mayor:{connected:true,eligible:true,joinOrder:1,meta:{hostCapability:{hardwareConcurrency:2,deviceMemory:2,rttMs:500,frameP95Ms:70}}},
    strong:{connected:true,eligible:true,joinOrder:2,meta:{hostCapability:{hardwareConcurrency:8,deviceMemory:8,rttMs:40,frameP95Ms:16,gpuP95Ms:14}}},
  };
  assert.equal(selectHostCandidate(members,{currentHostId:'old',mayorId:'mayor'}),'strong');
});

test('mayor remains preferred when capability is otherwise comparable',()=>{
  const cap={hardwareConcurrency:4,deviceMemory:4,rttMs:80,frameP95Ms:28};
  const members={old:{connected:true,eligible:true,joinOrder:0},mayor:{connected:true,eligible:true,joinOrder:2,meta:{hostCapability:cap}},peer:{connected:true,eligible:true,joinOrder:1,meta:{hostCapability:cap}}};
  assert.equal(selectHostCandidate(members,{currentHostId:'old',mayorId:'mayor'}),'mayor');
});

test('unstable background peer is excluded when a stable candidate exists',()=>{
  const members={old:{connected:true,eligible:true,joinOrder:0},hidden:{connected:true,eligible:true,joinOrder:1,meta:{hostCapability:{foreground:false,hardwareConcurrency:16,deviceMemory:16}}},stable:{connected:true,eligible:true,joinOrder:2,meta:{hostCapability:{foreground:true,hardwareConcurrency:2,deviceMemory:2}}}};
  const ranked=rankHostCandidates(members,{currentHostId:'old'});
  assert.deepEqual(ranked.map(row=>row.id),['stable']);
  assert.equal(normalizeHostCapability({foreground:false}).stable,false);
});

test('ties remain deterministic by join order and peer id',()=>{
  const cap={foreground:true,hardwareConcurrency:4,deviceMemory:4};
  const members={old:{connected:true,eligible:true,joinOrder:0},z:{connected:true,eligible:true,joinOrder:5,meta:{hostCapability:cap}},b:{connected:true,eligible:true,joinOrder:3,meta:{hostCapability:cap}},a:{connected:true,eligible:true,joinOrder:3,meta:{hostCapability:cap}}};
  assert.deepEqual(rankHostCandidates(members,{currentHostId:'old'}).map(row=>row.id),['a','b','z']);
});
