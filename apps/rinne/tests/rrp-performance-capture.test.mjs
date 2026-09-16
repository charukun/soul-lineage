import test from 'node:test';
import assert from 'node:assert/strict';
import {installRrpPerformanceCapture} from '../src/coop/performance-capture.js';

test('capture controller exposes one peer raw capture and keeps probe timing boundaries intact',()=>{
  let clock=0,session=null,tick=null,cleared=null;
  const windowRef={};
  const capture=installRrpPerformanceCapture({
    getSession:()=>session,
    buildInfo:{commit:'abc123',environment:'dev'},
    now:()=>clock,
    documentRef:null,
    windowRef,
    setIntervalFn:fn=>{tick=fn;return 77;},
    clearIntervalFn:id=>{cleared=id;},
  });
  assert.equal(typeof tick,'function');
  assert.equal(windowRef.__RRP_CAPTURE__,capture);
  assert.equal(capture.raw(),null);

  const probe=capture.performanceProbeFactory('peer');
  session={role:'guest',worldId:'room-1',performance:()=>probe.snapshot()};
  probe.inputSent(4);clock=80;probe.inputAcknowledged(4);clock=112;probe.inputDisplayed(4);probe.recordFrame(16.7);
  clock=1000;tick();
  const raw=capture.raw();
  assert.deepEqual(raw.inputToAuthoritativeAckMs,[80]);
  assert.deepEqual(raw.inputToDisplayMs,[112]);
  assert.deepEqual(raw.frameMs,[16.7]);
  assert.deepEqual(raw.peerUplinkKbps,[0]);
  assert.equal(raw.bandwidthSkippedBuckets,0);
  assert.equal(raw._capture.schema,'rrp-raw-peer-capture');
  assert.equal(raw._capture.role,'guest');
  assert.equal(raw._capture.worldId,'room-1');
  assert.equal(raw._capture.buildRevision,'abc123');
  assert.equal(raw._capture.environment,'dev');
  assert.equal(JSON.parse(capture.json())._capture.role,'guest');

  capture.dispose();
  assert.equal(cleared,77);
  assert.equal('__RRP_CAPTURE__' in windowRef,false);
});

test('capture cadence marks a throttled interval as missing instead of inventing idle bandwidth',()=>{
  let clock=0,session=null;
  const capture=installRrpPerformanceCapture({getSession:()=>session,now:()=>clock,documentRef:null,windowRef:{},setIntervalFn:()=>1,clearIntervalFn:()=>{}});
  const probe=capture.performanceProbeFactory('host');session={role:'host',worldId:'room-2',performance:()=>probe.snapshot()};
  probe.recordSend({payloadBytes:100,reliableBufferedAmount:0,presenceBufferedAmount:0});clock=3500;capture.sample();
  const raw=capture.raw();assert.deepEqual(raw.hostUplinkKbps,[.8]);assert.equal(raw.bandwidthSkippedBuckets,2);capture.dispose();
});
