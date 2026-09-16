import test from 'node:test';
import assert from 'node:assert/strict';
import {absorbExternalFamily,genericParetoFrontier,proveCatalogAgnosticClosure,proveMonotoneObjectiveNoRegret,proveParetoSupersetClosure,strictlyDominatesCost,weaklyDominatesCost} from '../src/game/reality-lab/frontier-closure.js';

const plan=(name,cost)=>({policies:[name],cost:{wireBytes:0,latencyMs:0,coordination:0,connections:0,cpuWork:0,infraUnits:0,rollbackExposure:0,...cost}});

test('Pareto closure preserves or improves every baseline point',()=>{
  const baseline={a:[plan('a1',{wireBytes:10,latencyMs:100}),plan('a2',{wireBytes:100,latencyMs:10})],b:[plan('b',{wireBytes:30,latencyMs:30})]};
  const composition=plan('mix',{wireBytes:20,latencyMs:20});
  const proof=proveParetoSupersetClosure({baselineFrontiers:baseline,candidatePlans:[...baseline.a,...baseline.b,composition]});
  assert.equal(proof.pass,true);assert.equal(proof.coveredPoints,3);assert.ok(proof.families.b.strict>0);
});

test('an arbitrary future family can be absorbed without regressing its own Pareto points',()=>{
  const existing=[plan('old',{wireBytes:20,latencyMs:20})],future=[plan('future-wire',{wireBytes:0,latencyMs:500}),plan('future-latency',{wireBytes:500,latencyMs:0})];
  const result=absorbExternalFamily(existing,'future',future);
  assert.equal(result.closure.pass,true);assert.equal(result.closure.coveredPoints,2);
});

test('candidate superset has no regret for sampled monotone objectives',()=>{
  const baseline={a:[plan('a',{wireBytes:10,latencyMs:100})],b:[plan('b',{wireBytes:100,latencyMs:10})]};
  const candidates=[...baseline.a,...baseline.b,plan('mix',{wireBytes:20,latencyMs:20})];
  assert.equal(proveMonotoneObjectiveNoRegret({baselineFrontiers:baseline,candidatePlans:candidates}).pass,true);
});

test('generic frontier retains incomparable extremes and removes dominated points',()=>{
  const wire=plan('wire',{wireBytes:0,latencyMs:100}),latency=plan('latency',{wireBytes:100,latencyMs:0}),bad=plan('bad',{wireBytes:110,latencyMs:110});
  const frontier=genericParetoFrontier([wire,latency,bad]);assert.equal(frontier.length,2);assert.ok(frontier.every(row=>row.policies[0]!=='bad'));
  assert.equal(weaklyDominatesCost(wire,bad),true);assert.equal(strictlyDominatesCost(wire,bad),true);
});

test('catalog-agnostic closure theorem passes including a previously unknown family',()=>{const proof=proveCatalogAgnosticClosure();assert.equal(proof.pass,true);assert.equal(proof.absorbed.pass,true);assert.equal(proof.objectives.pass,true);});
