import test from 'node:test';
import assert from 'node:assert/strict';
import {installRrpPerformanceCapture} from '../src/coop/performance-capture.js';

test('capture controller arms at the intended peer count and measures from that clean window',()=>{
  let clock=0,session=null,tick=null,cleared=null;const windowRef={location:{search:''}};
  const capture=installRrpPerformanceCapture({getSession:()=>session,buildInfo:{commit:'abc123',environment:'dev'},now:()=>clock,documentRef:null,windowRef,setIntervalFn:fn=>{tick=fn;return 77;},clearIntervalFn:id=>{cleared=id;}});
  assert.equal(typeof tick,'function');assert.equal(windowRef.__RRP_CAPTURE__,capture);assert.equal(capture.raw(),null);assert.equal(capture.expectedPeers,2);
  const probe=capture.performanceProbeFactory('peer');let connected=1;session={role:'guest',worldId:'room-1',selfId:'guest-1',snapshot:()=>({phase:'open',view:{connected}}),performance:()=>probe.snapshot()};
  capture.sample();assert.equal(capture.armed(),false);assert.equal(capture.reset(),false);probe.inputSent(1);clock=50;probe.inputAcknowledged(1);assert.equal(probe.snapshot().inputToAuthoritativeAckMs.length,1);
  connected=2;capture.sample();assert.equal(capture.armed(),true);assert.deepEqual(probe.snapshot().inputToAuthoritativeAckMs,[],'arming must discard pre-window timing samples');
  probe.inputSent(4);clock=130;probe.inputAcknowledged(4);clock=162;probe.inputDisplayed(4);probe.recordFrame(16.7);clock=1050;tick();const raw=capture.raw();
  assert.deepEqual(raw.inputToAuthoritativeAckMs,[80]);assert.deepEqual(raw.inputToDisplayMs,[112]);assert.deepEqual(raw.frameMs,[16.7]);assert.deepEqual(raw.peerUplinkKbps,[0]);assert.equal(raw.bandwidthSkippedBuckets,0);
  assert.equal(raw._capture.schema,'rrp-raw-peer-capture');assert.equal(raw._capture.role,'guest');assert.equal(raw._capture.worldId,'room-1');assert.equal(raw._capture.peerId,'guest-1');assert.equal(raw._capture.buildRevision,'abc123');assert.equal(raw._capture.environment,'dev');assert.equal(raw._capture.expectedPeers,2);assert.equal(raw._capture.windowArmed,true);assert.equal(JSON.parse(capture.json())._capture.role,'guest');
  clock=1100;assert.equal(capture.reset(),true);assert.deepEqual(probe.snapshot().inputToDisplayMs,[]);capture.dispose();assert.equal(cleared,77);assert.equal('__RRP_CAPTURE__' in windowRef,false);
});

test('rrpPeers query prevents early certification before the requested cohort is present',()=>{
  let session=null,connected=2;const capture=installRrpPerformanceCapture({getSession:()=>session,documentRef:null,windowRef:{location:{search:'?rrpCapture=1&rrpPeers=3'}},setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const probe=capture.performanceProbeFactory('host');session={role:'host',worldId:'room-3',selfId:'host-3',snapshot:()=>({phase:'open',view:{connected}}),performance:()=>probe.snapshot()};capture.sample();assert.equal(capture.expectedPeers,3);assert.equal(capture.armed(),false);assert.equal(capture.reset(),false);
  connected=3;capture.sample();assert.equal(capture.armed(),true);assert.equal(capture.raw()._capture.expectedPeers,3);capture.dispose();
});

test('steady capture preserves pre-loss samples and measures reopen after the cohort returns',()=>{
  let clock=0,session=null,connected=2;const capture=installRrpPerformanceCapture({getSession:()=>session,now:()=>clock,documentRef:null,windowRef:{location:{search:''}},setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const probe=capture.performanceProbeFactory('peer');session={role:'guest',worldId:'room-drop',selfId:'guest-drop',snapshot:()=>({phase:connected>=2?'open':'closed',view:{connected}}),performance:()=>probe.snapshot()};capture.sample();assert.equal(capture.armed(),true);probe.recordFrame(16);clock=1000;capture.sample();assert.equal(capture.raw().frameMs.length,1);
  connected=1;clock=1100;capture.sample();assert.equal(capture.armed(),false);assert.deepEqual(probe.snapshot().frameMs,[16]);assert.equal(capture.reset(),false);connected=2;clock=1500;capture.sample();assert.equal(capture.armed(),true);assert.deepEqual(capture.raw().frameMs,[16]);assert.deepEqual(capture.raw().hostReopenMs,[400]);capture.dispose();
});

test('capture cadence marks a throttled armed interval as missing instead of inventing idle bandwidth',()=>{
  let clock=0,session=null;const capture=installRrpPerformanceCapture({getSession:()=>session,now:()=>clock,documentRef:null,windowRef:{location:{search:''}},setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const probe=capture.performanceProbeFactory('host');session={role:'host',worldId:'room-2',selfId:'host-2',snapshot:()=>({phase:'open',view:{connected:2}}),performance:()=>probe.snapshot()};capture.sample();assert.equal(capture.armed(),true);
  probe.recordSend({payloadBytes:100,reliableBufferedAmount:0,presenceBufferedAmount:0});clock=3500;capture.sample();const raw=capture.raw();assert.deepEqual(raw.hostUplinkKbps,[.8]);assert.equal(raw.bandwidthSkippedBuckets,2);capture.dispose();
});


test('capture variant sink writes exact semantic payloads with matched JSON/no-compression provenance',()=>{
  let clock=0,session=null;const stored=new Map(),windowRef={location:{search:'?rrpCapture=1&rrpPeers=2&rrpWorkload=final-v1&rrpVariant=semantic-journal&rrpRpo=1'},localStorage:{setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)}};
  const capture=installRrpPerformanceCapture({getSession:()=>session,now:()=>clock,documentRef:null,windowRef,setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const probe=capture.performanceProbeFactory('host');session={role:'host',worldId:'room-variant',selfId:'host-variant',snapshot:()=>({phase:'open',view:{connected:2}}),performance:()=>probe.snapshot(),diagnostics:()=>({semanticShadow:{status:'tracking',journalTypes:['life-seal']}})};
  capture.semanticMeasurement({warmStart:true,eventCount:0,checkpointPayload:{world:{id:'bootstrap'}},journalPayload:[]});capture.sample();assert.equal(capture.armed(),true);
  clock=500;capture.semanticMeasurement({warmStart:false,eventCount:1,checkpointPayload:{world:{id:'sealed'}},journalPayload:[{type:'life-seal'}]});
  clock=1600;capture.semanticMeasurement({warmStart:false,eventCount:0,checkpointPayload:{world:{id:'provisional'}},journalPayload:[]});const raw=capture.raw();
  assert.equal(raw._capture.variant,'semantic-journal');assert.equal(raw._capture.rpoSeconds,1);assert.equal(raw._capture.encoding,'json-utf8');assert.equal(raw._capture.compression,'none');assert.equal(raw._capture.workloadId,'final-v1');
  assert.equal(raw.variantBootstrapBytes.length,1);assert.equal(raw.variantProtectedBytes.length,1);assert.equal(raw.variantProvisionalBytes.length,1);assert.equal(raw.variantErrors.length,0);assert(stored.size>=3);capture.dispose();
});
