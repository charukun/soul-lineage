import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRrpPerformanceSamples} from '../src/game/reality-lab/performance-contract.js';
import {createCoopPerformanceProbe} from '../src/coop/performance.js';
import {createRoomWire} from '../src/coop/wire.js';

test('input timing survives authoritative acknowledgement until the acknowledged state is rendered',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({now:()=>clock});
  probe.inputSent(1);clock=40;probe.inputSent(2);clock=125;assert.equal(probe.inputAcknowledged(2),true);
  clock=150;assert.equal(probe.inputDisplayed(2),true);
  probe.canonIntent('life:1');clock=350;assert.equal(probe.canonCommitted('life:1'),true);
  const raw=probe.snapshot();assert.deepEqual(raw.inputToAuthoritativeAckMs,[85]);assert.deepEqual(raw.inputToDisplayMs,[110]);assert.deepEqual(raw.canonCommitMs,[200]);assert.equal(raw.pendingInputs,0);assert.equal(raw.pendingDisplayInputs,0);assert.equal(raw.pendingCanon,0);
});

test('superseded or aborted inputs do not create fabricated latency samples',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({now:()=>clock});
  probe.inputSent(1);clock=10;probe.inputSent(2);clock=20;probe.inputAcknowledged(2);clock=30;assert.equal(probe.inputDisplayed(1),false);assert.equal(probe.inputDisplayed(2),true);
  probe.inputSent(3);assert.equal(probe.inputAborted(3),true);clock=100;probe.inputAcknowledged(3);
  const raw=probe.snapshot();assert.deepEqual(raw.inputToAuthoritativeAckMs,[10]);assert.deepEqual(raw.inputToDisplayMs,[20]);
});

test('aborted canon intents do not create latency samples',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({now:()=>clock});probe.canonIntent('life:1');assert.equal(probe.canonAborted('life:1'),true);clock=100;assert.equal(probe.canonCommitted('life:1'),false);assert.deepEqual(probe.snapshot().canonCommitMs,[]);
});

test('explicit render latency remains available for capture layers that already own the full timing boundary',()=>{
  const probe=createCoopPerformanceProbe();probe.recordInputToDisplay(123);const raw=probe.snapshot();assert.deepEqual(raw.inputToDisplayMs,[123]);
});

test('wire instrumentation counts UTF-8 payload bytes and DataChannel queue pressure in fixed one-second buckets',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({role:'peer',now:()=>clock}),frames=[];
  const connection={channel:{readyState:'open',bufferedAmount:120},presenceBufferedAmount:()=>45,send:frame=>{frames.push(frame);connection.channel.bufferedAmount+=20;}};
  const wire=createRoomWire(()=>{},{now:()=>clock,onSendSample:sample=>probe.recordSend(sample)}),message={type:'x',text:'百年転生'};
  assert.equal(wire.send(connection,message),true);assert.ok(frames.length>0);clock=999;assert.equal(probe.snapshot().peerUplinkKbps.length,0);clock=1000;
  const raw=probe.snapshot();assert.equal(raw.reliableBufferedAmountBytes[0]>=120,true);assert.equal(raw.presenceBufferedAmountBytes[0],45);assert.equal(raw.peerUplinkKbps.length,1);
  const expectedBytes=new TextEncoder().encode(JSON.stringify(message)).byteLength;assert.equal(raw.peerUplinkKbps[0],expectedBytes*8/1000);
  clock=2000;assert.deepEqual(probe.snapshot().peerUplinkKbps,[expectedBytes*8/1000,0]);
});

test('long background gaps are marked unobserved instead of fabricated as zero traffic',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({role:'peer',now:()=>clock,maxSamples:32});
  probe.recordSend({payloadBytes:100,reliableBufferedAmount:0,presenceBufferedAmount:0});clock=24*60*60*1000;
  const raw=probe.snapshot();assert.deepEqual(raw.peerUplinkKbps,[.8]);assert.equal(raw.bandwidthSkippedBuckets,86399);
});

test('replaceable backpressure drop records queue pressure and a zero-byte bandwidth window',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({role:'host',now:()=>clock});
  const connection={channel:{readyState:'open',bufferedAmount:70000},presenceBufferedAmount:()=>0,send:()=>assert.fail('must not send')};
  const wire=createRoomWire(()=>{},{now:()=>clock,onSendSample:sample=>probe.recordSend(sample)});assert.equal(wire.send(connection,{type:'view'},{replaceable:true}),false);
  clock=1000;const raw=probe.snapshot();assert.equal(raw.reliableBufferedAmountBytes[0],70000);assert.deepEqual(raw.hostUplinkKbps,[0]);
});

test('selected relay candidate is counted when getStats exposes it',async()=>{
  const probe=createCoopPerformanceProbe(),rows=new Map([
    ['transport',{id:'transport',type:'transport',selectedCandidatePairId:'pair'}],
    ['pair',{id:'pair',type:'candidate-pair',localCandidateId:'local',remoteCandidateId:'remote'}],
    ['local',{id:'local',type:'local-candidate',candidateType:'relay'}],
    ['remote',{id:'remote',type:'remote-candidate',candidateType:'srflx'}],
  ]);rows.forEach=(fn)=>{for(const value of rows.values())fn(value);};
  const connection={pc:{getStats:async()=>rows}};probe.connectionAttempt();await probe.connectionOpen(connection);await probe.connectionOpen(connection);
  const raw=probe.snapshot();assert.equal(raw.connectionAttempts,1);assert.equal(raw.connectionSuccesses,1);assert.equal(raw.turnCandidateClassifiedConnections,1);assert.equal(raw.turnRelayConnections,1);assert.equal(aggregateRrpPerformanceSamples(raw).turnRelayRate,1);
});

test('TURN rate stays unknown when selected candidate type cannot be established',async()=>{
  const probe=createCoopPerformanceProbe(),connection={pc:{getStats:async()=>{throw Error('unsupported');}}};probe.connectionAttempt();await probe.connectionOpen(connection);
  const raw=probe.snapshot();assert.equal(raw.connectionSuccesses,1);assert.equal(raw.turnCandidateClassifiedConnections,0);assert.equal(aggregateRrpPerformanceSamples(raw).turnRelayRate,null);
});


test('protected semantic commits record the durable save latency while replaceable saves do not',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({now:()=>clock});
  probe.recordSemanticCommit({checkpointBytes:1000,journalBytes:0,eventCount:0,historyEffects:0,commitLatencyMs:40});
  probe.recordSemanticCommit({checkpointBytes:1200,journalBytes:140,eventCount:1,historyEffects:1,commitLatencyMs:55});
  const raw=probe.snapshot();assert.deepEqual(raw.semanticEventCount,[0,1]);assert.deepEqual(raw.canonCommitMs,[55]);
});
