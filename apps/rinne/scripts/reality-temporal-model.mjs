export const Verdict = Object.freeze({ALLOW:'ALLOW', DENY:'DENY', AMBIGUOUS:'AMBIGUOUS'});

export function classifyInterval({earliest,latest,deadline,inclusive=false}) {
  if (![earliest,latest,deadline].every(Number.isFinite) || earliest>latest) throw new Error('invalid interval');
  if (inclusive) {
    if (latest<=deadline) return Verdict.ALLOW;
    if (earliest>deadline) return Verdict.DENY;
  } else {
    if (latest<deadline) return Verdict.ALLOW;
    if (earliest>=deadline) return Verdict.DENY;
  }
  return Verdict.AMBIGUOUS;
}

export function unauthenticatedClientTimestampWitness({deadline=100}={}) {
  const arrival=200, claimed=99;
  return {
    honest:{actualActionTime:99,claimedActionTime:claimed,arrival},
    dishonest:{actualActionTime:101,claimedActionTime:claimed,arrival},
    localAuthorityObservation:{claimedActionTime:claimed,arrival},
    indistinguishable:true,
    desired:{honest:'accept',dishonest:'reject'},
  };
}

export function authorityReceiveDeadline({actionTime,arrivalTime,deadline}) {
  return {actionTime,arrivalTime,deadline,accepted:arrivalTime<=deadline};
}

export function finiteGraceCounterexample({deadline=100,grace=10,epsilon=.001}={}) {
  const actionTime=deadline-epsilon;
  const arrivalTime=deadline+grace+1;
  return {actionTime,arrivalTime,deadline,grace,honestBefore:actionTime<deadline,rejected:arrivalTime>deadline+grace};
}

export function actionAttestationDistinction() {
  return {
    secureTimeSync:{authenticatedClockSample:true,bindsGameAction:false},
    eventAttestation:{authenticatedClockSample:true,bindsGameAction:true},
  };
}

export function scaledGameTime({realSeconds,rate,paused=false}) {
  if(!Number.isFinite(realSeconds)||realSeconds<0||!Number.isFinite(rate)||rate<0) throw new Error('invalid scale');
  return paused ? 0 : realSeconds*rate;
}

export function monotonicElapsed({start,end}) {
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start) throw new Error('invalid monotonic interval');
  return end-start;
}

export function wallClockJumpWitness() {
  return {
    wall:{before:1000,after:900,elapsed:-100},
    monotonic:{before:5000,after:5100,elapsed:100},
  };
}

export function operationDeadlineStore({deadline,policyGeneration=1}={}) {
  const accepted=new Map();
  return {
    submit({operationId,arrivalTime,payload,policyGen=policyGeneration}) {
      if(!operationId) throw new Error('operation id required');
      const prior=accepted.get(operationId);
      if(prior) {
        if(JSON.stringify(prior.payload)!==JSON.stringify(payload)) return {status:'conflict',receipt:null};
        return {status:'replay',receipt:prior.receipt};
      }
      if(policyGen!==policyGeneration) return {status:'generation-mismatch',receipt:null};
      if(arrivalTime>deadline) return {status:'late',receipt:null};
      const receipt=Object.freeze({operationId,acceptedAt:arrivalTime,policyGeneration});
      accepted.set(operationId,{payload:structuredClone(payload),receipt});
      return {status:'accepted',receipt};
    },
    updatePolicy({deadline:next,generation}) {
      if(!Number.isFinite(next)||!Number.isInteger(generation)||generation<=policyGeneration) throw new Error('invalid policy update');
      deadline=next; policyGeneration=generation;
    },
    get deadline(){return deadline;},
    get policyGeneration(){return policyGeneration;},
  };
}

export function deadlineGenerationWitness() {
  const action={operationId:'op1',arrivalTime:90,payload:{x:1},policyGen:1};
  const oldPolicy={deadline:100,generation:1};
  const newPolicy={deadline:80,generation:2};
  return {
    action,oldPolicy,newPolicy,
    acceptedUnderOld:action.arrivalTime<=oldPolicy.deadline,
    acceptedUnderNew:action.arrivalTime<=newPolicy.deadline,
    generationMismatch:action.policyGen!==newPolicy.generation,
  };
}

export function timeDomainExamples() {
  return {
    lifetime:{domain:'game',description:'age/world progression follows configured game clock rate'},
    inviteExpiry:{domain:'authority-wall',description:'real-world expiry window'},
    saveStall:{domain:'monotonic',description:'elapsed process duration'},
    adversarialActionDeadline:{domain:'attested-action-time-or-authority-receive',description:'must declare which observer defines timeliness'},
  };
}

export function deadlineContractIssues(c) {
  const issues=[];
  if(!c||typeof c!=='object')return['missing-contract'];
  const need=(x,n)=>{if(!x)issues.push(n)};
  need(['game','monotonic','authority-wall','attested-wall'].includes(c.clockDomain),'clock-domain');
  need(['game-time','authority-receive-time','attested-action-time','lease-expiry','none'].includes(c.deadlineKind),'deadline-kind');
  if(c.deadlineKind!=='none'){
    need(Number.isFinite(c.deadlineValue),'deadline-value');
    need(c.deadlinePolicyRoot,'deadline-policy-root');
    need(Number.isInteger(c.deadlineGeneration),'deadline-generation');
    need(c.retrySemantics==='operation-id-anchored','retry-semantics');
    need(['reject','ambiguous-escalate','explicit-late','delay'].includes(c.failureMode),'failure-mode');
  }
  if(c.clockDomain==='attested-wall' || c.deadlineKind==='attested-action-time'){
    need(c.clockAuthorityRoot,'clock-authority-root');
    need(c.actionTimestampAttestation===true,'action-time-attestation');
  }
  if(c.uncertaintyAware===true) need(c.uncertaintyModel,'uncertainty-model');
  return issues;
}

export function uncertaintyShrink({center,wideError,narrowError,deadline}) {
  const wide={earliest:center-wideError,latest:center+wideError,deadline};
  const narrow={earliest:center-narrowError,latest:center+narrowError,deadline};
  return {wide:{...wide,verdict:classifyInterval(wide)},narrow:{...narrow,verdict:classifyInterval(narrow)}};
}

export function impossibleFiniteGraceClaim({deadline=100,grace=10}={}) {
  const honest=finiteGraceCounterexample({deadline,grace});
  return {
    claim:'all honest actions before D eventually accepted while all arrivals after finite D+G rejected under unbounded delay',
    witness:honest,
    contradiction:honest.honestBefore && honest.rejected,
  };
}

export const witnessNames=Object.freeze([
  'unauthenticated-action-time-indistinguishability',
  'receive-time-semantics-differs-from-action-time',
  'finite-grace-unbounded-delay',
  'secure-time-sync-not-action-attestation',
  'game-vs-wall-vs-monotonic-domain',
  'wall-clock-jump-vs-monotonic',
  'retry-after-deadline-idempotency',
  'deadline-generation-binding',
  'uncertainty-interval-ambiguity',
]);
