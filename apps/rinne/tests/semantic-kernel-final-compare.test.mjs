import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFinalSemanticKernelCaptureSet } from '../scripts/semantic-kernel-final-compare.mjs';

const variantCapture=(variant,role,{worldId=`world-${variant}`,commitBytes,protectedBytes,provisionalBytes=[]}={})=>{
  const host=role==='host',meta={schema:'rrp-raw-peer-capture',version:1,role,worldId,peerId:host?'host':'guest',buildRevision:'build-a',environment:'dev',expectedPeers:2,windowArmed:true,workloadId:'final-v1',variant,rpoSeconds:2,encoding:'json-utf8',compression:'none',capabilities:{memoryMb:false,gpuMs:false,batteryPctPerHour:false,turnCandidateStats:true}};
  return{
    _capture:meta,_diagnostics:host?{semanticShadow:{status:'tracking',coverage:'restored',journalTypes:['life-seal']},semanticError:null,semanticPersistenceError:null}:null,
    durationMinutes:1,bandwidthSkippedBuckets:0,
    inputToAuthoritativeAckMs:host?[]:[20,21],inputToDisplayMs:host?[]:[30,31],canonCommitMs:host?[5]:[],
    hostLossDetectionMs:host?[]:[2750],hostReopenMs:host?[]:[400],
    peerUplinkKbps:host?[]:[4,5],hostUplinkKbps:host?[9,10]:[],
    reliableBufferedAmountBytes:[0,2],presenceBufferedAmountBytes:[0,1],stateFreshnessMs:host?[]:[5,10],positionErrorM:[],
    rollbackMs:[],frameMs:[16,17],gpuMs:[],memoryMb:[],batteryPctPerHour:[],
    semanticCheckpointBytes:host?[1000,1100]:[],semanticJournalBytes:host?[0,100]:[],semanticEventCount:host?[0,1]:[],semanticHistoryEffects:host?[0,1]:[],
    connectionAttempts:host?1:1,connectionSuccesses:host?1:1,turnCandidateClassifiedConnections:host?1:1,turnRelayConnections:0,
    variantBootstrapMs:host?[1]:[],variantBootstrapBytes:host?[900]:[],variantCommitMs:host?[1,2]:[],variantCommitBytes:host?(commitBytes??[]):[],
    variantProtectedCommitMs:host?[2]:[],variantProtectedBytes:host?[protectedBytes??100]:[],variantProvisionalWriteMs:host&&provisionalBytes.length?[1]:[],variantProvisionalBytes:host?provisionalBytes:[],variantErrors:[],
  };
};
const pair=(variant,options)=>[variantCapture(variant,'host',options),variantCapture(variant,'guest',options)];

test('final comparison accepts matched A/B/C captures and selects semantic split with known event sourcing when measured persistence wins',()=>{
  const captures=[
    ...pair('all-state-strong',{commitBytes:[1000,1100],protectedBytes:1100}),
    ...pair('semantic-journal',{commitBytes:[100],protectedBytes:100,provisionalBytes:[500]}),
    ...pair('fair-known-event-sourcing',{commitBytes:[100],protectedBytes:100,provisionalBytes:[500]}),
  ];
  const result=analyzeFinalSemanticKernelCaptureSet(captures);
  assert.equal(result.physicalComplete,true);assert.equal(result.architectureDecision,'semantic-split-with-known-event-sourcing');
  assert.equal(result.crossVariantCompatibility.comparable,true);assert.equal(result.variants['semantic-journal'].semantic.semanticEvents,1);
  assert.equal(result.comparison.knownAndSemanticUseIdenticalImplementationPath,true);assert(result.comparison.allStateToSemanticTotalBytesRatio<1);
});

test('final comparison fails closed on missing variant or mismatched protected event sequence',()=>{
  const missing=analyzeFinalSemanticKernelCaptureSet([...pair('all-state-strong',{commitBytes:[1000],protectedBytes:1000}),...pair('semantic-journal',{commitBytes:[100],protectedBytes:100,provisionalBytes:[500]})]);
  assert.equal(missing.physicalComplete,false);assert(missing.issues.includes('missing-fair-known-event-sourcing'));
  const captures=[...pair('all-state-strong',{commitBytes:[1000],protectedBytes:1000}),...pair('semantic-journal',{commitBytes:[100],protectedBytes:100,provisionalBytes:[500]}),...pair('fair-known-event-sourcing',{commitBytes:[100],protectedBytes:100,provisionalBytes:[500]})];
  captures.find(row=>row._capture.variant==='fair-known-event-sourcing'&&row._capture.role==='host')._diagnostics.semanticShadow.journalTypes=['birth'];
  const mismatch=analyzeFinalSemanticKernelCaptureSet(captures);assert.equal(mismatch.physicalComplete,false);assert.equal(mismatch.crossVariantCompatibility.comparable,false);
});

test('battery/GPU remain optional and a write failure cannot be hidden as a passing capture',()=>{
  const captures=[...pair('all-state-strong',{commitBytes:[1000],protectedBytes:1000}),...pair('semantic-journal',{commitBytes:[100],protectedBytes:100,provisionalBytes:[500]}),...pair('fair-known-event-sourcing',{commitBytes:[100],protectedBytes:100,provisionalBytes:[500]})];
  const host=captures.find(row=>row._capture.variant==='semantic-journal'&&row._capture.role==='host');host.variantErrors=['quota'];
  const result=analyzeFinalSemanticKernelCaptureSet(captures);assert.equal(result.physicalComplete,false);assert(result.issues.includes('semantic-journal:variant-write-error'));assert.equal(result.variants['semantic-journal'].optional.batteryPctPerHour,null);
});
