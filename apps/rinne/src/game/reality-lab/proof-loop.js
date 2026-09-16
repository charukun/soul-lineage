import {DEFAULTS,STEP_MS,normalizeConfig} from './config.js';
import {runComparison} from './engine.js';
import {compareRequirementEnvelope,runCanonNucleusProofSuite} from './canon-nucleus.js';

export const ARCHITECTURE_PROOF_MATRIX=Object.freeze([
  {id:'clean-spread',layout:'spread',scenario:'steady',durationMs:16000,latencyMs:0,jitterMs:0,loss:0},
  {id:'clean-dense',layout:'dense',scenario:'steady',durationMs:16000,latencyMs:0,jitterMs:0,loss:0},
  {id:'wan-spread',layout:'spread',scenario:'steady',durationMs:16000,latencyMs:80,jitterMs:20,loss:.01},
  {id:'adverse-dense',layout:'dense',scenario:'steady',durationMs:16000,latencyMs:240,jitterMs:120,loss:.08},
  {id:'host-clean',layout:'spread',scenario:'host',durationMs:24000,latencyMs:80,jitterMs:20,loss:0},
  {id:'host-lossy',layout:'spread',scenario:'host',durationMs:24000,latencyMs:180,jitterMs:80,loss:.05},
  {id:'cell-failure',layout:'spread',scenario:'cell',durationMs:16000,latencyMs:120,jitterMs:50,loss:.02},
  {id:'corruption',layout:'spread',scenario:'divergence',durationMs:16000,latencyMs:80,jitterMs:20,loss:0},
  {id:'collapse-revisit',layout:'dense',scenario:'collapse',durationMs:16000,latencyMs:120,jitterMs:50,loss:.02},
]);

function workloadFrom(result,config){
  const ticks=Math.max(1,Math.floor(config.durationMs/STEP_MS));
  const fanout=Math.max(1,config.peers-1);
  return Math.max(1,Math.ceil(result.payloadBytes/(ticks*fanout)));
}
function findMode(results,mode){return results.find(row=>row.mode===mode);}
export function runArchitectureProofLoop(){
  const canon=runCanonNucleusProofSuite(),cases=[];
  for(const spec of ARCHITECTURE_PROOF_MATRIX){
    const config=normalizeConfig({...DEFAULTS,peers:30,...spec});
    const results=runComparison(config),comparisons={};
    for(const result of results){
      const realtimeBytesPerTick=workloadFrom(result,config);
      comparisons[result.mode]=compareRequirementEnvelope({players:config.peers,ticks:Math.max(1,Math.floor(config.durationMs/STEP_MS)),realtimeBytesPerTick,canonEvents:4,canonBytesPerEvent:512,recoveryBytesPerCanon:16_384,reliableMultiplier:1+config.loss,pendingCanonActors:1});
    }
    const interest=findMode(results,'interest'),cells=findMode(results,'cells');
    cases.push({id:spec.id,config,results,comparisons,presence:{cellFanoutWin:Boolean(interest&&cells&&cells.maxPeerKbps<interest.maxPeerKbps*.9),cellLoadRatio:interest&&cells&&interest.maxPeerKbps?cells.maxPeerKbps/interest.maxPeerKbps:null},pass:results.every(row=>row.freezeViolations===0&&row.collapseMatchesReference)&&Object.values(comparisons).every(row=>row.pass)});
  }
  const dense=cases.find(row=>row.id==='clean-dense'),spread=cases.find(row=>row.id==='clean-spread'),host=cases.find(row=>row.id==='host-clean'),corruption=cases.find(row=>row.id==='corruption');
  const boundaries={denseCounterexampleRetained:Boolean(dense&&!dense.presence.cellFanoutWin),spreadBenefitRetained:Boolean(spread&&spread.presence.cellFanoutWin),hostRecoveryObserved:Boolean(host&&host.results.every(row=>row.phase==='open'&&row.migrations.length===1&&row.freezeViolations===0)),corruptionRepairObserved:Boolean(corruption&&corruption.results.every(row=>row.invalid===1&&row.repairs>=1))};
  const pass=canon.pass&&cases.every(row=>row.pass)&&Object.values(boundaries).every(Boolean);
  return{format:'rrp-architecture-proof/1',pass,canon,cases,boundaries,limits:['model wire does not certify SCTP/NAT/TURN','non-Byzantine nucleus; malicious peers are outside this proof','canon safety is proved; replaceable realtime state may roll back to the last recovery capsule']};
}
