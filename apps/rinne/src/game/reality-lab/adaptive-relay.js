import {combinations} from './canon-nucleus.js';

const finite=(value,name)=>{if(!Number.isFinite(value)||value<0)throw Error(`Invalid ${name}`);return value;};
const integer=(value,name,min=0)=>{if(!Number.isInteger(value)||value<min)throw Error(`Invalid ${name}`);return value;};

export function directPresenceStar({players=30,payloadBytes=1,hopLatencyMs=0}={}){
  integer(players,'players',2);finite(payloadBytes,'payloadBytes');finite(hopLatencyMs,'hopLatencyMs');const recipients=players-1;
  return Object.freeze({kind:'direct-star',players,recipients,relays:0,redundancy:0,hostFanout:recipients,relayFanoutMax:0,maxSenderFanout:recipients,aggregateTransmissions:recipients,hostUplinkBytes:recipients*payloadBytes,aggregateBytes:recipients*payloadBytes,maxPathHops:1,averagePrimaryPathHops:1,maxExtraHopLatencyMs:0,relayFailureTolerance:Infinity,relayIds:[],nonRelayIds:Array.from({length:recipients},(_,i)=>`p${i+1}`),assignments:{}});
}

export function relayPresencePlan({players=30,relays=5,redundancy=1,payloadBytes=1,hopLatencyMs=0}={}){
  integer(players,'players',2);finite(payloadBytes,'payloadBytes');finite(hopLatencyMs,'hopLatencyMs');const recipients=players-1;integer(relays,'relays',1);integer(redundancy,'redundancy',1);if(relays>recipients)throw Error('Relay count exceeds recipients');if(redundancy>relays)throw Error('Relay redundancy exceeds relay count');
  const ids=Array.from({length:recipients},(_,i)=>`p${i+1}`),relayIds=ids.slice(0,relays),nonRelayIds=ids.slice(relays),assignments={},relayLoads=Object.fromEntries(relayIds.map(id=>[id,0]));
  for(let i=0;i<nonRelayIds.length;i++){const chosen=[];for(let copy=0;copy<redundancy;copy++){const relay=relayIds[(i*redundancy+copy)%relays];chosen.push(relay);relayLoads[relay]++;}assignments[nonRelayIds[i]]=chosen;}
  const relayFanoutMax=Math.max(0,...Object.values(relayLoads)),aggregateTransmissions=relays+redundancy*nonRelayIds.length,maxPathHops=nonRelayIds.length?2:1,averagePrimaryPathHops=recipients?(relays+2*nonRelayIds.length)/recipients:0;
  return Object.freeze({kind:'adaptive-relay',players,recipients,relays,redundancy,hostFanout:relays,relayFanoutMax,maxSenderFanout:Math.max(relays,relayFanoutMax),aggregateTransmissions,hostUplinkBytes:relays*payloadBytes,aggregateBytes:aggregateTransmissions*payloadBytes,maxPathHops,averagePrimaryPathHops,maxExtraHopLatencyMs:nonRelayIds.length?hopLatencyMs:0,relayFailureTolerance:nonRelayIds.length?redundancy-1:Infinity,relayIds,nonRelayIds,assignments:Object.freeze(assignments),relayLoads:Object.freeze(relayLoads)});
}

export function relayFanoutLowerBound({players=30,relays=5,redundancy=1}={}){
  integer(players,'players',2);integer(relays,'relays',1);integer(redundancy,'redundancy',1);const recipients=players-1;if(relays>recipients||redundancy>relays)throw Error('Invalid relay lower-bound input');const nonRelays=recipients-relays,minRelayFanout=Math.ceil(redundancy*nonRelays/relays);return Object.freeze({hostFanout:relays,minRelayFanout,minMaxSenderFanout:Math.max(relays,minRelayFanout)});
}

export function optimizeRelayPresence({players=30,redundancy=1,payloadBytes=1,hopLatencyMs=0}={}){
  integer(players,'players',2);integer(redundancy,'redundancy',1);const recipients=players-1;if(redundancy>recipients)throw Error('Relay redundancy exceeds recipient count');let best=null;
  for(let relays=redundancy;relays<=recipients;relays++){const plan=relayPresencePlan({players,relays,redundancy,payloadBytes,hopLatencyMs});if(!best||plan.maxSenderFanout<best.maxSenderFanout||plan.maxSenderFanout===best.maxSenderFanout&&plan.hostFanout<best.hostFanout||plan.maxSenderFanout===best.maxSenderFanout&&plan.hostFanout===best.hostFanout&&plan.aggregateBytes<best.aggregateBytes)best=plan;}return best;
}

export function relayFailureCoverage(plan,{failures=1}={}){
  integer(failures,'failures',0);if(plan.kind!=='adaptive-relay')return{pass:true,failures,scenarios:[],noIntermediaryDependency:true};if(failures>plan.relayIds.length)return{pass:false,failures,scenarios:[],noIntermediaryDependency:false};
  const scenarios=[];for(const failed of combinations(plan.relayIds,failures)){const uncovered=plan.nonRelayIds.filter(id=>plan.assignments[id].every(relay=>failed.includes(relay)));scenarios.push({failed,uncovered});}return{pass:scenarios.every(row=>row.uncovered.length===0),failures,scenarios,noIntermediaryDependency:false};
}

function validatePresenceOperation(operation={}){if(operation.replaceable!==true||operation.irreversible||operation.requiresTotalOrder||operation.requiresCrashSurvival||operation.requiresByzantine||operation.requiresExternalOrder)throw Error('Adaptive relay is only valid for replaceable presence');return true;}

export function chooseAdaptivePresence({players=30,payloadBytes=1,hopLatencyMs=0,maxSenderFanout=Infinity,maxExtraHops=1,requiredRelayFailures=0,operation={replaceable:true}}={}){
  validatePresenceOperation(operation);integer(players,'players',2);finite(payloadBytes,'payloadBytes');finite(hopLatencyMs,'hopLatencyMs');if(maxSenderFanout!==Infinity)finite(maxSenderFanout,'maxSenderFanout');integer(maxExtraHops,'maxExtraHops',0);integer(requiredRelayFailures,'requiredRelayFailures',0);
  const star=directPresenceStar({players,payloadBytes,hopLatencyMs}),candidates=[star];for(let redundancy=1;redundancy<=Math.min(3,players-1);redundancy++)candidates.push(optimizeRelayPresence({players,redundancy,payloadBytes,hopLatencyMs}));
  const feasible=candidates.filter(plan=>plan.maxSenderFanout<=maxSenderFanout&&plan.maxPathHops-1<=maxExtraHops&&(plan.kind==='direct-star'||plan.relayFailureTolerance>=requiredRelayFailures));
  feasible.sort((a,b)=>a.hostUplinkBytes-b.hostUplinkBytes||a.maxSenderFanout-b.maxSenderFanout||a.aggregateBytes-b.aggregateBytes||a.maxPathHops-b.maxPathHops||(a.kind==='direct-star'?-1:b.kind==='direct-star'?1:0));
  return Object.freeze({pass:feasible.length>0,selected:feasible[0]??null,candidates,feasible});
}

export function proveRelayConstructionOptimality({maxPlayers=64,maxRedundancy=2}={}){
  integer(maxPlayers,'maxPlayers',3);integer(maxRedundancy,'maxRedundancy',1);const rows=[];
  for(let players=3;players<=maxPlayers;players++)for(let redundancy=1;redundancy<=Math.min(maxRedundancy,players-1);redundancy++){const best=optimizeRelayPresence({players,redundancy});let theoretical=Infinity;for(let relays=redundancy;relays<=players-1;relays++)theoretical=Math.min(theoretical,relayFanoutLowerBound({players,relays,redundancy}).minMaxSenderFanout);rows.push({players,redundancy,relays:best.relays,constructed:best.maxSenderFanout,theoretical,pass:best.maxSenderFanout===theoretical});}
  return{pass:rows.every(row=>row.pass),rows};
}

export function proveDenseAdaptiveRelay(){
  const players=30,payloadBytes=1024,star=directPresenceStar({players,payloadBytes}),r1=optimizeRelayPresence({players,redundancy:1,payloadBytes}),r2=optimizeRelayPresence({players,redundancy:2,payloadBytes}),r1Failure=relayFailureCoverage(r1,{failures:1}),r2Failure=relayFailureCoverage(r2,{failures:1});
  const hostBound=chooseAdaptivePresence({players,payloadBytes,maxSenderFanout:8,maxExtraHops:1,requiredRelayFailures:0}),faultBound=chooseAdaptivePresence({players,payloadBytes,maxSenderFanout:8,maxExtraHops:1,requiredRelayFailures:1}),zeroExtraHop=chooseAdaptivePresence({players,payloadBytes,maxExtraHops:0});
  let canonRejected=false;try{chooseAdaptivePresence({players,operation:{replaceable:false,irreversible:true,requiresTotalOrder:true,requiresCrashSurvival:true}});}catch{canonRejected=true;}
  const denseFixedCellBusiestFanout=players-1,checks={r1Optimum:r1.relays===5&&r1.maxSenderFanout===5,r1SameAggregate:r1.aggregateTransmissions===star.aggregateTransmissions,r1HostRelief:r1.hostFanout<star.hostFanout,r1AddsHop:r1.maxPathHops===2,r1NotOneRelayFaultSafe:r1Failure.pass===false,r2Optimum:r2.relays===7&&r2.maxSenderFanout===7,r2OneRelayFaultSafe:r2Failure.pass===true,r2CostsExtraTraffic:r2.aggregateTransmissions>star.aggregateTransmissions,denseCellCounterexampleEscaped:r1.maxSenderFanout<denseFixedCellBusiestFanout,hostBoundSelectsRelay:hostBound.selected?.kind==='adaptive-relay'&&hostBound.selected.maxSenderFanout<=8,faultBoundSelectsRedundantRelay:faultBound.selected?.kind==='adaptive-relay'&&faultBound.selected.relayFailureTolerance>=1,zeroExtraHopSelectsStar:zeroExtraHop.selected?.kind==='direct-star',canonIsolation:canonRejected};
  return{pass:Object.values(checks).every(Boolean),players,star,r1,r2,r1Failure,r2Failure,hostBound,faultBound,zeroExtraHop,denseFixedCellBusiestFanout,checks,limits:['relay r=1 lowers sender fan-out but adds one hop and has intermediary failure exposure','relay r=2 tolerates one relay-path failure for non-relay recipients but increases aggregate traffic','relay planning applies only to replaceable presence; Canon/authority never depends on this relay path','analytic fan-out proof does not certify browser scheduling, radio behavior or real WebRTC throughput']};
}

export function runAdaptiveRelayProofSuite(){const optimality=proveRelayConstructionOptimality(),dense=proveDenseAdaptiveRelay();return{pass:optimality.pass&&dense.pass,optimality,dense};}
