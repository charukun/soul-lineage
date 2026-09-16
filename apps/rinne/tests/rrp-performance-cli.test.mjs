import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPerformanceEvidence,mergeRawPerformanceCaptures} from '../scripts/rrp-performance-contract.mjs';
import {EVIDENCE_CLASS,RRP_SAFETY_KEYS} from '../src/game/reality-lab/performance-contract.js';

const safety=()=>Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,0]));
const provenance={buildRevision:'abc',runtime:'Chrome',deviceClass:'mixed-physical',deviceModel:'Pixel Fold + desktop peer',peers:2,networkProfile:'wifi-lan'};
const routeCapture=(role,overrides={})=>({
  _capture:{schema:'rrp-raw-peer-capture',version:1,role,worldId:'room',buildRevision:'abc',environment:'dev',expectedPeers:2,windowArmed:true,capturedAt:'2026-09-17T00:00:00Z',...(overrides._capture||{})},
  durationMinutes:1,bandwidthSkippedBuckets:0,connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:0,turnRelayConnections:0,...overrides,
});

test('multipeer raw captures merge legacy host and guest samples without inventing missing fields',()=>{
  const host={hostUplinkKbps:[800,900],reliableBufferedAmountBytes:[1000],durationMinutes:1,bandwidthSkippedBuckets:2,connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:1,turnRelayConnections:0};
  const guest={inputToAuthoritativeAckMs:[100,120],peerUplinkKbps:[100,120],durationMinutes:1,bandwidthSkippedBuckets:3,connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:0,turnRelayConnections:0};
  const merged=mergeRawPerformanceCaptures([host,guest]);
  assert.deepEqual(merged.hostUplinkKbps,[800,900]);assert.deepEqual(merged.peerUplinkKbps,[100,120]);assert.deepEqual(merged.inputToAuthoritativeAckMs,[100,120]);assert.equal(merged.connectionAttempts,2);assert.equal(merged.connectionSuccesses,2);assert.equal(merged.durationMinutes,2);assert.equal(merged.bandwidthSkippedBuckets,5);assert.deepEqual(merged.inputToDisplayMs,[]);
});

test('capture metadata prevents host and guest endpoints from counting one WebRTC link twice',()=>{
  const host=routeCapture('host',{connectionAttempts:3,connectionSuccesses:3,turnCandidateClassifiedConnections:2,turnRelayConnections:1});
  const guestA=routeCapture('guest',{connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:1,turnRelayConnections:0});
  const guestB=routeCapture('guest',{connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:1,turnRelayConnections:1});
  const merged=mergeRawPerformanceCaptures([host,guestA,guestB]);assert.equal(merged.connectionAttempts,3);assert.equal(merged.connectionSuccesses,3);assert.equal(merged.turnCandidateClassifiedConnections,2);assert.equal(merged.turnRelayConnections,1);
});

test('connection dedupe is scoped per world and keeps guest-only evidence for a lost Host capture',()=>{
  const hostA=routeCapture('host',{_capture:{worldId:'room-a'},connectionAttempts:2,connectionSuccesses:2});
  const guestA=routeCapture('guest',{_capture:{worldId:'room-a'},connectionAttempts:1,connectionSuccesses:1});
  const guestB=routeCapture('guest',{_capture:{worldId:'room-b'},connectionAttempts:1,connectionSuccesses:1});
  const merged=mergeRawPerformanceCaptures([hostA,guestA,guestB]);assert.equal(merged.connectionAttempts,3);assert.equal(merged.connectionSuccesses,3);
});

test('build accepts continuously sampled legacy peer captures and emits one physical-multipeer evidence object',()=>{
  const evidence=buildPerformanceEvidence({evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,captures:[
    {hostUplinkKbps:[800,900],durationMinutes:1,bandwidthSkippedBuckets:0,connectionAttempts:1,connectionSuccesses:1},
    {inputToAuthoritativeAckMs:[100,120],peerUplinkKbps:[100,120],durationMinutes:1,bandwidthSkippedBuckets:0,connectionAttempts:1,connectionSuccesses:1},
  ],safety:safety(),provenance});
  assert.equal(evidence.evidenceClass,EVIDENCE_CLASS.PHYSICAL_MULTIPEER);assert.equal(evidence.metrics.hostUplinkP95Kbps,900);assert.equal(evidence.metrics.peerUplinkP95Kbps,120);assert.equal(evidence.metrics.inputToAuthoritativeAckP95Ms,120);assert.equal(evidence.metrics.inputToDisplayP95Ms,null);assert.equal(evidence.metrics.connectionSuccessRate,1);
});

test('routed physical capture must be armed at the declared peer target and build revision',()=>{
  const host=routeCapture('host',{hostUplinkKbps:[800]});const guest=routeCapture('guest',{peerUplinkKbps:[100],inputToAuthoritativeAckMs:[120]});
  assert.doesNotThrow(()=>buildPerformanceEvidence({evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,captures:[host,guest],safety:safety(),provenance}));
  assert.throws(()=>buildPerformanceEvidence({evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,captures:[routeCapture('host',{_capture:{windowArmed:false}}),guest],safety:safety(),provenance}),/not armed/);
  assert.throws(()=>buildPerformanceEvidence({evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,captures:[routeCapture('host',{_capture:{expectedPeers:3}}),guest],safety:safety(),provenance}),/expected peer count/);
  assert.throws(()=>buildPerformanceEvidence({evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,captures:[routeCapture('host',{_capture:{buildRevision:'other'}}),guest],safety:safety(),provenance}),/build revision/);
});

test('physical evidence build rejects unobserved bandwidth buckets instead of treating gaps as idle traffic',()=>{
  assert.throws(()=>buildPerformanceEvidence({evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,captures:[
    {hostUplinkKbps:[800],durationMinutes:1,bandwidthSkippedBuckets:0},
    {peerUplinkKbps:[100],durationMinutes:1,bandwidthSkippedBuckets:1},
  ],safety:safety(),provenance}),/unobserved bandwidth buckets/);
});
