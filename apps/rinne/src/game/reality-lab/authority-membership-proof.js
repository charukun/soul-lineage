import {combinations} from './canon-nucleus.js';
import {crashQuorumConfig} from './canon-packet-proof.js';

const intersection=(a,b)=>a.filter(value=>b.includes(value));

export function membershipSets(failures=1){
  const {members,quorum}=crashQuorumConfig(failures),oldMembers=Array.from({length:members},(_,i)=>`n${i}`),replacement=`n${members}`,newMembers=[...oldMembers.slice(0,-1),replacement],common=oldMembers.filter(id=>newMembers.includes(id));
  return{failures,members,quorum,oldMembers,newMembers,common,replacement,removed:oldMembers.at(-1)};
}

export function directMembershipSwitchCounterexample({failures=1}={}){
  const config=membershipSets(failures),oldQuorums=combinations(config.oldMembers,config.quorum),newQuorums=combinations(config.newMembers,config.quorum);
  for(const oldQuorum of oldQuorums)for(const newQuorum of newQuorums)if(intersection(oldQuorum,newQuorum).length===0)return{pass:true,...config,oldQuorum,newQuorum,counterexample:'activating the new membership without a bridging configuration can admit disjoint old/new majorities'};
  return{pass:false,...config,oldQuorum:null,newQuorum:null};
}

export function proveOneMemberBridgeReconfiguration({maxFailures=4}={}){
  const rows=[];
  for(let failures=1;failures<=maxFailures;failures++){
    const config=membershipSets(failures),oldQuorums=combinations(config.oldMembers,config.quorum),newQuorums=combinations(config.newMembers,config.quorum),bridgeQuorums=combinations(config.common,config.quorum);let minOldIntersection=Infinity,minNewIntersection=Infinity;
    for(const bridge of bridgeQuorums){for(const quorum of oldQuorums)minOldIntersection=Math.min(minOldIntersection,intersection(bridge,quorum).length);for(const quorum of newQuorums)minNewIntersection=Math.min(minNewIntersection,intersection(bridge,quorum).length);}
    const direct=directMembershipSwitchCounterexample({failures}),pass=bridgeQuorums.length>0&&minOldIntersection>=1&&minNewIntersection>=1&&direct.pass;
    rows.push({...config,bridgeQuorums:bridgeQuorums.length,minOldIntersection,minNewIntersection,directCounterexample:direct.pass,pass});
  }
  return{pass:rows.every(row=>row.pass),rows};
}

export function proveSuspendedMemberRotation(){
  const config=membershipSets(1),bridge=['n0','n1'],suspended=config.removed,newMember=config.replacement;
  const oldLiveAfterSuspension=config.oldMembers.filter(id=>id!==suspended),oldQuorumAvailable=oldLiveAfterSuspension.length>=config.quorum,bridgeAvailable=bridge.every(id=>oldLiveAfterSuspension.includes(id));
  const transition={parentRoot:'canon-root-17',bridgeHolders:[...bridge],newMemberRecoveryCopied:true,newMembers:config.newMembers};
  const canOpenNew=oldQuorumAvailable&&bridgeAvailable&&transition.bridgeHolders.length>=config.quorum&&transition.newMemberRecoveryCopied;
  const oneOldExtraFailureLive=oldLiveAfterSuspension.filter(id=>id!=='n0'),blockedAfterTooManyUnavailable=oneOldExtraFailureLive.length<config.quorum;
  return{pass:oldQuorumAvailable&&bridgeAvailable&&canOpenNew&&blockedAfterTooManyUnavailable,config,suspended,newMember,transition,oldQuorumAvailable,canOpenNew,blockedAfterTooManyUnavailable,rule:'background/suspended authority is treated as unavailable for new Canon; rotate only through an old-majority bridge, otherwise fail closed'};
}

export function proveMembershipRotationLimits(){
  const twoAtOnceOld=['a','b','c'],twoAtOnceNew=['a','d','e'],q=2,common=intersection(twoAtOnceOld,twoAtOnceNew),hasCommonMajority=common.length>=q;
  return{pass:hasCommonMajority===false,oldMembers:twoAtOnceOld,newMembers:twoAtOnceNew,common,requiresJointConsensusOrSequentialReplacement:true,reason:'replacing two members of a 3-node nucleus destroys the common-majority bridge; use sequential one-member transitions or a joint-consensus protocol'};
}

export function runAuthorityMembershipProofSuite(){
  const direct=directMembershipSwitchCounterexample(),bridges=proveOneMemberBridgeReconfiguration(),suspension=proveSuspendedMemberRotation(),limits=proveMembershipRotationLimits();
  return{pass:direct.pass&&bridges.pass&&suspension.pass&&limits.pass,direct,bridges,suspension,limits};
}
