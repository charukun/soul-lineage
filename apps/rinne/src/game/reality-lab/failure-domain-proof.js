import {combinations} from './canon-nucleus.js';
import {crashQuorumConfig} from './canon-packet-proof.js';
import {optimizeRelayPresence} from './adaptive-relay.js';

const uniq=values=>[...new Set(values)];

export function durableDomainCoverage({holders,domainOf,failures=1}={}){
  if(!Array.isArray(holders)||!domainOf||typeof domainOf!=='object'||!Number.isInteger(failures)||failures<0)throw Error('Invalid durable failure-domain proof input');
  const domains=uniq(holders.map(id=>domainOf[id]).filter(Boolean)),failureSets=combinations(domains,Math.min(failures,domains.length));
  const worstSurvivors=failureSets.length?Math.min(...failureSets.map(failed=>holders.filter(id=>!failed.includes(domainOf[id])).length)):holders.length;
  return{pass:domains.length>=failures+1&&worstSurvivors>=1,holders:[...holders],domains,failureSets:failureSets.length,worstSurvivors};
}

export function proveCanonFailureDomainBoundary({maxFailures=3}={}){
  const rows=[];
  for(let failures=1;failures<=maxFailures;failures++){
    const {quorum}=crashQuorumConfig(failures),holders=Array.from({length:quorum},(_,i)=>`n${i}`),diverse=Object.fromEntries(holders.map((id,i)=>[id,`d${i}`])),collapsed=Object.fromEntries(holders.map(id=>[id,'shared-domain']));
    const diverseProof=durableDomainCoverage({holders,domainOf:diverse,failures}),collapsedProof=durableDomainCoverage({holders,domainOf:collapsed,failures});rows.push({failures,quorum,diverse:diverseProof,collapsed:collapsedProof,pass:diverseProof.pass&&!collapsedProof.pass});
  }
  return{pass:rows.every(row=>row.pass),rows,counterexample:'f+1 durable copies do not imply f-domain durability when multiple copies share one failure domain'};
}

export function relayDomainFailureCoverage(plan,{domainOf,failures=1}={}){
  if(plan.kind!=='adaptive-relay')return{pass:true,uncovered:[]};if(!domainOf||typeof domainOf!=='object')throw Error('Relay failure domains are required');
  const relayDomains=uniq(plan.relayIds.map(id=>domainOf[id]).filter(Boolean)),failureSets=combinations(relayDomains,Math.min(failures,relayDomains.length)),uncovered=[];
  for(const failedDomains of failureSets)for(const recipient of plan.nonRelayIds){const surviving=plan.assignments[recipient].some(relay=>!failedDomains.includes(domainOf[relay]));if(!surviving)uncovered.push({failedDomains,recipient,relays:plan.assignments[recipient]});}
  return{pass:relayDomains.length>=failures+1&&uncovered.length===0,relayDomains,failureSets:failureSets.length,uncovered};
}

export function proveRelayFailureDomainBoundary(){
  const plan=optimizeRelayPresence({players:30,redundancy:2}),uniqueDomains=Object.fromEntries(plan.relayIds.map((id,i)=>[id,`relay-domain-${i}`])),collapsedDomains=Object.fromEntries(plan.relayIds.map(id=>[id,'same-uplink-domain']));
  const diverse=relayDomainFailureCoverage(plan,{domainOf:uniqueDomains,failures:1}),collapsed=relayDomainFailureCoverage(plan,{domainOf:collapsedDomains,failures:1});
  return{pass:diverse.pass&&!collapsed.pass,plan:{relays:plan.relays,redundancy:plan.redundancy,maxSenderFanout:plan.maxSenderFanout},diverse,collapsed,counterexample:'two relay copies on different peers are not one-domain-fault tolerant if both peers share the failed transport/power domain'};
}

export function runFailureDomainProofSuite(){const canon=proveCanonFailureDomainBoundary(),relay=proveRelayFailureDomainBoundary();return{pass:canon.pass&&relay.pass,canon,relay,limits:['failure-domain labels are an explicit model input; the proof cannot infer physical independence from peer IDs','a shared Wi-Fi/router outage is a transport availability domain even if device-local durable storage survives','domain diversity is a requirement on placement, not evidence that real devices or networks are independent']};}
