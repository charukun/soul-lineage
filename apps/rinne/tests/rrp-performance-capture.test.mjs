import test from 'node:test';
import assert from 'node:assert/strict';
import {installRrpPerformanceCapture} from '../src/coop/performance-capture.js';

test('capture controller arms at the intended peer count and measures from that clean window',()=>{
  let clock=0,session=null,tick=null,cleared=null;
  const windowRef={location:{search:''}};
  const capture=installRrpPerformanceCapture({
    getSession:()=>session,
    buildInfo:{commit:'abc123',environment:'dev'},
    now:()=>clock,
    documentRef:null,
    windowRef,
    setIntervalFn:fn=>{tick=fn;return 77;},
    clearIntervalFn:id=>{cleared=id;},
  });
  assert.equal(typeof tick,'function');assert.equal(windowRef.__RRP_CAPTURE__,capture);assert.equal(capture.raw(),null);assert.equal(capture.expectedPeers,2);

  const probe=capture.performanceProbeFactory('peer');
  let connected=1;session={role:'guest',worldId:'room-1',snapshot:()=>({phase:'open',view:{connected}}),performance:()=>probe.snapshot()};
  capture.sample();assert.equal(capture.armed(),false);assert.equal(capture.reset(),false);
  probe.inputSent(1);clock=50;probe.inputAcknowledged(1);assert.equal(probe.snapshot().inputToAuthoritativeAckMs.length,1);

  connected=2;capture.sample();assert.equal(capture.armed(),true);assert.deepEqual(probe.snapshot().inputToAuthoritativeAckMs,[],'arming must discard pre-window timing samples');
  probe.inputSent(4);clock=130;probe.inputAcknowledged(4);clock=162;probe.inputDisplayed(4);probe.recordFrame(16.7);
  clock=1050;tick();const raw=capture.raw();
  assert.deepEqual(raw.inputToAuthoritativeAckMs,[80]);assert.deepEqual(raw.inputToDisplayMs,[112]);assert.deepEqual(raw.frameMs,[16.7]);assert.deepEqual(raw.peerUplinkKbps,[0]);assert.equal(raw.bandwidthSkippedBuckets,0);
  assert.equal(raw._capture.schema,'rrp-raw-peer-capture');assert.equal(raw._capture.role,'guest');assert.equal(raw._capture.worldId,'room-1');assert.equal(raw._capture.buildRevision,'abc123');assert.equal(raw._capture.environment,'dev');assert.equal(raw._capture.expectedPeers,2);assert.equal(raw._capture.windowArmed,true);assert.equal(JSON.parse(capture.json())._capture.role,'guest');

  clock=1100;assert.equal(capture.reset(),true);assert.deepEqual(probe.snapshot().inputToDisplayMs,[]);capture.dispose();assert.equal(cleared,77);assert.equal('__RRP_CAPTURE__' in windowRef,false);
});

test('rrpPeers query prevents early certification before the requested cohort is present',()=>{
  let session=null,connected=2;
  const capture=installRrpPerformanceCapture({getSession:()=>session,documentRef:null,windowRef:{location:{search:'?rrpCapture=1&rrpPeers=3'}},setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const probe=capture.performanceProbeFactory('host');session={role:'host',worldId:'room-3',snapshot:()=>({phase:'open',view:{connected}}),performance:()=>probe.snapshot()};
  capture.sample();assert.equal(capture.expectedPeers,3);assert.equal(capture.armed(),false);assert.equal(capture.reset(),false);
  connected=3;capture.sample();assert.equal(capture.armed(),true);assert.equal(capture.raw()._capture.expectedPeers,3);capture.dispose();
});

test('capture cadence marks a throttled armed interval as missing instead of inventing idle bandwidth',()=>{
  let clock=0,session=null;
  const capture=installRrpPerformanceCapture({getSession:()=>session,now:()=>clock,documentRef:null,windowRef:{location:{search:''}},setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const probe=capture.performanceProbeFactory('host');session={role:'host',worldId:'room-2',snapshot:()=>({phase:'open',view:{connected:2}}),performance:()=>probe.snapshot()};capture.sample();assert.equal(capture.armed(),true);
  probe.recordSend({payloadBytes:100,reliableBufferedAmount:0,presenceBufferedAmount:0});clock=3500;capture.sample();const raw=capture.raw();assert.deepEqual(raw.hostUplinkKbps,[.8]);assert.equal(raw.bandwidthSkippedBuckets,2);capture.dispose();
});
