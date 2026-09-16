import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPerformanceEvidence,mergeRawPerformanceCaptures} from '../scripts/rrp-performance-contract.mjs';
import {EVIDENCE_CLASS,RRP_SAFETY_KEYS} from '../src/game/reality-lab/performance-contract.js';

const safety=()=>Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,0]));

test('multipeer raw captures merge host and guest samples without inventing missing fields',()=>{
  const host={hostUplinkKbps:[800,900],reliableBufferedAmountBytes:[1000],durationMinutes:1,connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:1,turnRelayConnections:0};
  const guest={inputToAuthoritativeAckMs:[100,120],peerUplinkKbps:[100,120],durationMinutes:1,connectionAttempts:1,connectionSuccesses:1,turnCandidateClassifiedConnections:0,turnRelayConnections:0};
  const merged=mergeRawPerformanceCaptures([host,guest]);
  assert.deepEqual(merged.hostUplinkKbps,[800,900]);
  assert.deepEqual(merged.peerUplinkKbps,[100,120]);
  assert.deepEqual(merged.inputToAuthoritativeAckMs,[100,120]);
  assert.equal(merged.connectionAttempts,2);
  assert.equal(merged.connectionSuccesses,2);
  assert.equal(merged.durationMinutes,2);
  assert.deepEqual(merged.inputToDisplayMs,[]);
});

test('build accepts separate peer captures and emits one physical-multipeer evidence object',()=>{
  const evidence=buildPerformanceEvidence({
    evidenceClass:EVIDENCE_CLASS.PHYSICAL_MULTIPEER,
    captures:[
      {hostUplinkKbps:[800,900],durationMinutes:1,connectionAttempts:1,connectionSuccesses:1},
      {inputToAuthoritativeAckMs:[100,120],peerUplinkKbps:[100,120],durationMinutes:1,connectionAttempts:1,connectionSuccesses:1},
    ],
    safety:safety(),
    provenance:{buildRevision:'abc',runtime:'Chrome',deviceClass:'mixed-physical',deviceModel:'Pixel Fold + desktop peer',peers:2,networkProfile:'wifi-lan'},
  });
  assert.equal(evidence.evidenceClass,EVIDENCE_CLASS.PHYSICAL_MULTIPEER);
  assert.equal(evidence.metrics.hostUplinkP95Kbps,900);
  assert.equal(evidence.metrics.peerUplinkP95Kbps,120);
  assert.equal(evidence.metrics.inputToAuthoritativeAckP95Ms,120);
  assert.equal(evidence.metrics.inputToDisplayP95Ms,null);
  assert.equal(evidence.metrics.connectionSuccessRate,1);
});
