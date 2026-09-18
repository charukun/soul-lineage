export function correlatedFailureDomainBoundary({ holders, domainByMember, failedDomain } = {}) {
  if (!Array.isArray(holders) || !domainByMember || typeof domainByMember !== 'object') throw new Error('holders and domain map required');
  const domains = [...new Set(holders.map(id => domainByMember[id]))];
  if (domains.some(domain => !domain)) throw new Error('every holder needs a declared failure domain');
  const survivors = holders.filter(id => domainByMember[id] !== failedDomain);
  return {
    holders: [...holders],
    independentDomains: domains.length,
    failedDomain,
    survivors,
    survives: survivors.length > 0,
    conclusion: 'replica count is not a failure-domain guarantee; correlated loss must be modeled separately',
  };
}

export function directMembershipSwitchCounterexample() {
  const oldMembers = ['a', 'b', 'c'];
  const newMembers = ['c', 'd', 'e'];
  const oldQuorum = ['a', 'b'];
  const newQuorum = ['d', 'e'];
  const intersection = oldQuorum.filter(id => newQuorum.includes(id));
  return {
    oldMembers,
    newMembers,
    oldQuorum,
    newQuorum,
    intersection,
    unsafeDirectSwitch: intersection.length === 0,
    counterexample: 'without a joint or otherwise proven reconfiguration step, an old quorum and a new quorum can certify conflicting successors without sharing evidence',
    resolution: 'delegate membership change to the chosen consensus protocol or prove an equivalent joint-transition invariant',
  };
}

export function classifyFailureModel({ crash = true, correlatedDomains = false, byzantine = false, storageLoss = false } = {}) {
  return {
    crash,
    correlatedDomains,
    byzantine,
    storageLoss,
    requiresDistinctProofObligations: [
      correlatedDomains && 'failure-domain placement',
      byzantine && 'Byzantine authentication/quorum protocol',
      storageLoss && 'durability/re-replication model',
    ].filter(Boolean),
  };
}
