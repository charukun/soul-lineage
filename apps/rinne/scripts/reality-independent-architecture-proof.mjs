import {
  correlatedFailureDomainBoundary,
  directMembershipSwitchCounterexample,
} from '../src/game/reality-lab/independent-boundaries.js';
import {
  exploreBoundedCommitSchedules,
  runIndependentCounterexamples,
} from '../src/game/reality-lab/independent-reconstruction.js';

const stateSpace = exploreBoundedCommitSchedules({ maxDepth: 8 });
const counterexamples = runIndependentCounterexamples();
const correlated = correlatedFailureDomainBoundary({
  holders: ['n0', 'n1'],
  domainByMember: { n0: 'domain-a', n1: 'domain-a', n2: 'domain-b' },
  failedDomain: 'domain-a',
});
const membership = directMembershipSwitchCounterexample();

const report = {
  pass: stateSpace.pass && counterexamples.pass && correlated.survives === false && membership.unsafeDirectSwitch,
  stateSpace,
  counterexamples,
  retainedCounterexamples: {
    correlatedFailure: correlated,
    directMembershipSwitch: membership,
  },
  conclusion: 'bounded evidence supports the local guards; strong consensus and reconfiguration remain delegated to established protocols rather than claimed as new RRP theorems',
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
