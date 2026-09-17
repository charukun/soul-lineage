import {
  exploreBoundedCommitSchedules,
  runIndependentCounterexamples,
} from '../src/game/reality-lab/independent-reconstruction.js';

const counterexamples = runIndependentCounterexamples();
const stateSpace = exploreBoundedCommitSchedules({ maxDepth: 8 });
const report = {
  pass: counterexamples.pass && stateSpace.pass,
  evidenceClasses: {
    A: 'conditional theorem / impossibility reasoning',
    B: 'bounded executable model evidence',
    C: 'assumption',
    D: 'heuristic or architecture hypothesis',
    E: 'requires physical measurement',
    F: 'open / not yet proved',
  },
  counterexamples,
  stateSpace,
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
