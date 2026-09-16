import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRrpPerformanceSamples} from '../src/game/reality-lab/performance-contract.js';
import {createCoopPerformanceProbe} from '../src/coop/performance.js';
import {createRoomWire} from '../src/coop/wire.js';

test('input and canon timers measure the applied input acknowledgement and irreversible acknowledgement',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({now:()=>clock});
  probe.inputSent(1);clock=40;probe.inputSent(2);clock=125;assert.equal(probe.inputAcknowledged(2),true);
  probe.canonIntent('life:1');clock=325;assert.equal(probe.canonCommitted('life:1'),true);
  const raw=probe.snapshot();assert.deepEqual(raw.inputToAuthoritativeAckMs,[85]);assert.deepEqual(raw.inputToDisplayMs,[]);assert.deepEqual(raw.canonCommitMs,[200]);assert.equal(raw.pendingInputs,0);assert.equal(raw.pendingCanon,0);
});

test('aborted input and canon intents do not create latency samples',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({now:()=>clock});
  probe.inputSent(1);assert.equal(probe.inputAborted(1),true);probe.canonIntent('life:1');assert.equal(probe.canonAborted('life:1'),true);clock=100;probe.inputAcknowledged(1);
  const raw=probe.snapshot();assert.deepEqual(raw.inputToAuthoritativeAckMs,[]);assert.deepEqual(raw.canonCommitMs,[]);
});

test('render latency stays separate until a render layer records it',()=>{
  const probe=createCoopPerformanceProbe();probe.recordInputToDisplay(123);const raw=probe.snapshot();assert.deepEqual(raw.inputToDisplayMs,[123]);
});

test('wire instrumentation counts UTF-8 payload bytes and DataChannel queue pressure without changing framing',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({role:'peer',now:()=>clock}),frames=[];
  const connection={channel:{readyState:'open',bufferedAmount:120},presenceBufferedAmount:()=>45,send:frame=>{frames.push(frame);connection.channel.bufferedAmount+=20;}};
  const wire=createRoomWire(()=>{},{now:()=>clock,onSendSample:sample=>probe.recordSend(sample)}),message={type:'x',text:'輪廻転焦'};
  assert.equal(wire.send(connection,message),true);assert.ok(frames.length>0);clock=1000;probe.snapshot();
  const raw=probe.snapshot();assert.equal(raw.reliableBufferedAmountBytes[0]>=120,true);assert.equal(raw.presenceBufferedAmountBytes[0],45);assert.equal(raw.peerUplinkKbps.length,1);
  const expectedBytes=new TextEncoder().encode(JSON.stringify(message)).byteLength;assert.equal(raw.peerUplinkKbps[0],expectedBytes*8/1000);
});

test('replaceable backpressure drop records queue pressure but no payload bytes',()=>{
  let clock=0;const probe=createCoopPerformanceProbe({role:'host',now:()=>clock});
  const connection={channel:{readyState:'open',bufferedAmount:70000},presenceBufferedAmount:()=>0,send:()=>assert.fail('must not send')};
  const wire=createRoomWire(()=>{},{now:()=>clock,onSendSample:sample=>probe.recordSend(sample)});assert.equal(wire.send(connection,{type:'view'},{replaceable:true}),false);
  clock=1000;const raw=probe.snapshot();assert.equal(raw.reliableBufferedAmountBytes[0],70000);assert.deepEqual(raw.hostUplinkKbps,[]);
});

test('selected relay candidate is counted when getStats exposes it',async()=>{
  const probe=createCoopPerformanceProbe(),rows=new Map([
    ['transport',{id:'transport',type:'transport',selectedCandidatePairId:'pair'}],
    ['pair',{id:'pair',type:'candidate-pair',localCandidateId:'local',remoteCandidateId:'remote'}],
    ['local',{id:'local',type:'local-candidate',candidateType:'relay'}],
    ['remote',{id:'remote',type:'remote-candidate',candidateType:'srflx'}],
  ]);rows.forEach=(fn)=>{for(const value of rows.values())fn(value);};
  const connection={pc:{getStats:async()=>rows}};probe.connectionAttempt();await probe.connectionOpen(connection);await probe.connectionOpen(connection);
  const raw=probe.snapshot();assert.equal(raw.connectionAttempts,1);assert.equal(raw.connectionSuccesses,1);assert.equal(raw.turnCandidateClassifiedConnections,1);assert.equal(raw.turnRelayConnections,1);
  assert.equal(aggregateRrpPerformanceSamples(raw).turnRelayRate,1);
});

test('TURN rate stays unknown when selected candidate type cannot be established',async()=>{
  const probe=createCoopPerformanceProbe(),connection={pc:{getStats:async()=>{throw Error('unsupported');}}};probe.connectionAttempt();await probe.connectionOpen(connection);
  const raw=probe.snapshot();assert.equal(raw.connectionSuccesses,1);assert.equal(raw.turnCandidateClassifiedConnections,0);assert.equal(aggregateRrpPerformanceSamples(raw).turnRelayRate,null);
});
