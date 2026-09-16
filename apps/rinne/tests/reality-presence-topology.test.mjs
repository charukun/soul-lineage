import test from 'node:test';
import assert from 'node:assert/strict';
import {choosePresenceTopology,externalSfuPresencePlan,proveSfuTradeoffBoundary} from '../src/game/reality-lab/presence-topology-proof.js';

test('30-player SFU baseline moves sender fan-out off peers but consumes infrastructure and one extra hop',()=>{
  const sfu=externalSfuPresencePlan({players:30,payloadBytes:1024});assert.equal(sfu.maxPeerSenderFanout,1);assert.equal(sfu.infraFanout,29);assert.equal(sfu.aggregateTransmissions,30);assert.equal(sfu.infraUnits,1);assert.equal(sfu.maxPathHops,2);
});

test('presence topology choice preserves project constraints instead of claiming peer relay universally wins',()=>{
  const proof=proveSfuTradeoffBoundary();assert.equal(proof.pass,true);assert.equal(proof.noInfra.selected.kind,'adaptive-relay');assert.equal(proof.infraFanoutOne.selected.kind,'external-sfu');assert.equal(proof.zeroExtraHop.selected.kind,'direct-star');assert.equal(proof.checks.peerRelayLessAggregate,true);assert.equal(proof.checks.sfuBestPlayerFanout,true);
  assert.equal(choosePresenceTopology({players:30,allowInfrastructure:false,maxPeerSenderFanout:1}).pass,false);
});
