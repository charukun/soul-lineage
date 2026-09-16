import {directPresenceStar,optimizeRelayPresence} from './adaptive-relay.js';

const finite=(value,name)=>{if(!Number.isFinite(value)||value<0)throw Error(`Invalid ${name}`);return value;};
const integer=(value,name,min=0)=>{if(!Number.isInteger(value)||value<min)throw Error(`Invalid ${name}`);return value;};

export function externalSfuPresencePlan({players=30,payloadBytes=1,hopLatencyMs=0}={}){
  integer(players,'players',2);finite(payloadBytes,'payloadBytes');finite(hopLatencyMs,'hopLatencyMs');const recipients=players-1;
  return Object.freeze({kind:'external-sfu',players,recipients,maxPeerSenderFanout:1,infraFanout:recipients,aggregateTransmissions:recipients+1,peerUplinkBytes:payloadBytes,aggregateBytes:(recipients+1)*payloadBytes,maxPathHops:2,maxExtraHopLatencyMs:hopLatencyMs,infraUnits:1,centralRelayDependency:true});
}
function normalizePeerPlan(plan){return Object.freeze({...plan,maxPeerSenderFanout:plan.maxSenderFanout,infraFanout:0,peerUplinkBytes:plan.hostUplinkBytes,infraUnits:0,centralRelayDependency:false});}

export function choosePresenceTopology({players=30,payloadBytes=1,hopLatencyMs=0,allowInfrastructure=false,maxPeerSenderFanout=Infinity,maxExtraHops=1,requiredRelayFailures=0}={}){
  integer(players,'players',2);finite(payloadBytes,'payloadBytes');finite(hopLatencyMs,'hopLatencyMs');if(maxPeerSenderFanout!==Infinity)finite(maxPeerSenderFanout,'maxPeerSenderFanout');integer(maxExtraHops,'maxExtraHops',0);integer(requiredRelayFailures,'requiredRelayFailures',0);
  const candidates=[normalizePeerPlan(directPresenceStar({players,payloadBytes,hopLatencyMs})),normalizePeerPlan(optimizeRelayPresence({players,redundancy:1,payloadBytes,hopLatencyMs})),normalizePeerPlan(optimizeRelayPresence({players,redundancy:2,payloadBytes,hopLatencyMs}))];if(allowInfrastructure)candidates.push(externalSfuPresencePlan({players,payloadBytes,hopLatencyMs}));
  const feasible=candidates.filter(plan=>plan.maxPeerSenderFanout<=maxPeerSenderFanout&&plan.maxPathHops-1<=maxExtraHops&&(plan.kind==='direct-star'||plan.kind==='external-sfu'||plan.relayFailureTolerance>=requiredRelayFailures));
  feasible.sort((a,b)=>a.maxPeerSenderFanout-b.maxPeerSenderFanout||a.infraUnits-b.infraUnits||a.aggregateBytes-b.aggregateBytes||a.maxPathHops-b.maxPathHops);
  return{pass:feasible.length>0,selected:feasible[0]??null,candidates,feasible};
}

export function proveSfuTradeoffBoundary(){
  const players=30,payloadBytes=1024,star=normalizePeerPlan(directPresenceStar({players,payloadBytes})),peerRelay=normalizePeerPlan(optimizeRelayPresence({players,redundancy:1,payloadBytes})),sfu=externalSfuPresencePlan({players,payloadBytes});
  const noInfra=choosePresenceTopology({players,payloadBytes,allowInfrastructure:false,maxPeerSenderFanout:8,maxExtraHops:1}),infraFanoutOne=choosePresenceTopology({players,payloadBytes,allowInfrastructure:true,maxPeerSenderFanout:1,maxExtraHops:1}),zeroExtraHop=choosePresenceTopology({players,payloadBytes,allowInfrastructure:true,maxExtraHops:0});
  const checks={sfuBestPlayerFanout:sfu.maxPeerSenderFanout<peerRelay.maxPeerSenderFanout,peerRelayNoInfra:peerRelay.infraUnits===0&&sfu.infraUnits===1,peerRelayLessAggregate:peerRelay.aggregateTransmissions<sfu.aggregateTransmissions,sfuAddsHop:sfu.maxPathHops===2,noInfraSelectsPeerRelay:noInfra.selected?.kind==='adaptive-relay',infraConstraintSelectsSfu:infraFanoutOne.selected?.kind==='external-sfu',zeroExtraHopSelectsDirect:zeroExtraHop.selected?.kind==='direct-star'};
  return{pass:Object.values(checks).every(Boolean),players,star,peerRelay,sfu,noInfra,infraFanoutOne,zeroExtraHop,checks,limits:['SFU model counts an external infrastructure unit and central relay hop but does not model provider redundancy or pricing','SFU can move sender fan-out off players when infrastructure is allowed; that is a different resource trade-off, not evidence peer relay universally dominates','project no-paid-runtime constraints may exclude SFU even when it is a valid theoretical Pareto point']};
}
