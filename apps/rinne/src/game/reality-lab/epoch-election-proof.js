import {combinations} from './canon-nucleus.js';
import {crashQuorumConfig} from './canon-packet-proof.js';

export function proveQuorumEpochFencing({maxFailures=4}={}){
  const rows=[];
  for(let f=1;f<=maxFailures;f++){
    const {members:n,quorum:q}=crashQuorumConfig(f),ids=Array.from({length:n},(_,i)=>`n${i}`),oldQuorums=combinations(ids,q),newQuorums=combinations(ids,q);let cases=0,minIntersection=Infinity,unsafeOldAfterElection=0;
    for(const oldSet of oldQuorums)for(const newSet of newQuorums){
      cases++;const intersection=oldSet.filter(id=>newSet.includes(id));minIntersection=Math.min(minIntersection,intersection.length);
      const maxEpoch=Object.fromEntries(ids.map(id=>[id,1]));for(const voter of newSet)maxEpoch[voter]=2;
      const oldCanCommit=oldSet.every(id=>maxEpoch[id]===1),newCanCommit=newSet.every(id=>maxEpoch[id]>=2);if(oldCanCommit)unsafeOldAfterElection++;
      if(!newCanCommit)throw Error('New quorum did not acquire epoch');
    }
    rows.push({failures:f,members:n,quorum:q,cases,minIntersection,unsafeOldAfterElection,pass:minIntersection>=1&&unsafeOldAfterElection===0});
  }
  return{pass:rows.every(row=>row.pass),rows};
}

export function proveFalseSuspicionSafety(){
  const members=['a','b','c'],quorum=2,oldLeader='a',candidate='b',voters=['b','c'],maxEpoch={a:1,b:1,c:1};for(const voter of voters)maxEpoch[voter]=2;
  const oldCommitQuorums=combinations(members,quorum).filter(row=>row.includes(oldLeader)),oldAttempts=oldCommitQuorums.map(row=>({quorum:row,accepted:row.every(id=>maxEpoch[id]===1)}));
  const newCommitAccepted=voters.every(id=>maxEpoch[id]===2),oldRejected=oldAttempts.every(row=>row.accepted===false);
  return{pass:newCommitAccepted&&oldRejected,oldLeader,candidate,voters,maxEpoch,oldAttempts,newCommitAccepted,falseSuspicionAllowed:true};
}

export function proveMinorityCannotPromote(){
  const members=['a','b','c'],quorum=2,components=[['a'],['b','c']],rows=components.map(component=>({component,canElect:component.length>=quorum}));return{pass:rows[0].canElect===false&&rows[1].canElect===true,rows,quorum};
}

export function proveUnsafeTimeoutSelfPromotionCounterexample(){
  const members=['a','b','c'],oldLeader='a',selfPromoted='b',oldQuorum=['a','c'],newLocal=['b'];
  const oldCanCommit=oldQuorum.length===2,newClaimsAuthority=newLocal.includes(selfPromoted),disjoint=oldQuorum.every(id=>!newLocal.includes(id));
  return{pass:oldCanCommit&&newClaimsAuthority&&disjoint,oldLeader,selfPromoted,oldQuorum,newLocal,counterexample:'timeout-only self-promotion without quorum fencing can coexist with an old majority that still commits'};
}

export function runEpochElectionProofSuite(){
  const generalized=proveQuorumEpochFencing(),falseSuspicion=proveFalseSuspicionSafety(),minority=proveMinorityCannotPromote(),unsafe=proveUnsafeTimeoutSelfPromotionCounterexample();
  return{pass:generalized.pass&&falseSuspicion.pass&&minority.pass&&unsafe.pass,generalized,falseSuspicion,minority,unsafe,limits:['the proof establishes safety of quorum-fenced epoch promotion, not guaranteed failure detection or bounded-time election','a majority partition may promote after suspicion, but liveness still depends on messages eventually reaching that majority','realtime presentation may choose different availability semantics; this proof applies to irreversible Canon authority']};
}
