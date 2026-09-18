import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeShadowCapture, comparableCaptureSet } from '../scripts/rrp-convergence-shadow-capture.mjs';

const capture=overrides=>({
  semanticCheckpointBytes:[1000,1200,1300,1500],
  semanticJournalBytes:[0,120,0,210],
  semanticEventCount:[0,1,0,2],
  semanticHistoryEffects:[0,1,0,1],
  _capture:{worldId:'w',expectedPeers:3,windowArmed:true,buildRevision:'a'},
  ...overrides,
});

test('real-workload counterfactual compares only protected commit samples',()=>{
  const result=analyzeShadowCapture(capture());
  assert.equal(result.samples,4);assert.equal(result.protectedCommits,2);assert.equal(result.semanticEvents,3);
  assert.equal(result.allStateStrongBytes,2700);assert.equal(result.semanticStrongBytes,330);assert.equal(result.fairKnownEventSourcingBytes,330);
  assert.equal(result.savingBytes,2370);assert(result.savingRatio>.87&&result.savingRatio<.88);assert.equal(result.fairBaselineMatches,true);
});

test('periodic checkpoint samples with no semantic event are not counted as strong-boundary traffic',()=>{
  const result=analyzeShadowCapture(capture({semanticCheckpointBytes:[9999],semanticJournalBytes:[0],semanticEventCount:[0],semanticHistoryEffects:[0]}));
  assert.equal(result.protectedCommits,0);assert.equal(result.allStateStrongBytes,0);assert.equal(result.semanticStrongBytes,0);assert.equal(result.savingRatio,null);
});

test('unaligned or fictional zero-event semantic bytes fail closed',()=>{
  assert.throws(()=>analyzeShadowCapture(capture({semanticJournalBytes:[0]})),/aligned/);
  assert.throws(()=>analyzeShadowCapture(capture({semanticJournalBytes:[4,120,0,210]})),/zero-event/);
  assert.throws(()=>analyzeShadowCapture(capture({semanticEventCount:[0,-1,0,2]})),/invalid/);
});

test('capture comparability requires the same world, peer target and armed window',()=>{
  assert.equal(comparableCaptureSet([capture(),capture({_capture:{worldId:'w',expectedPeers:3,windowArmed:true,buildRevision:'b'}})]).comparable,true);
  assert.equal(comparableCaptureSet([capture(),capture({_capture:{worldId:'other',expectedPeers:3,windowArmed:true}})]).comparable,false);
  assert.equal(comparableCaptureSet([capture(),capture({_capture:{worldId:'w',expectedPeers:2,windowArmed:false}})]).comparable,false);
});
