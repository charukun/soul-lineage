// Independent adversarial model for RRP reconstruction.
// This is research evidence, not a production consensus implementation.
// The public surface is kept here while protocol, scheduler, and semantic
// analysis responsibilities are split into bounded modules for reviewability.

export { RECONSTRUCTION_EVIDENCE } from './independent-shared.js';
export {
  createLocalNode,
  majorityQuorum,
  modelRoot,
  receiveLocal,
} from './independent-protocol.js';
export {
  createCluster,
  crashProcess,
  deliverAt,
  dropAt,
  durableRoots,
  enqueue,
  exploreBoundedCommitSchedules,
  independentOracle,
  pauseProcess,
  resumeProcess,
  storageLoss,
} from './independent-cluster.js';
export {
  causalObservationHorizon,
  clientDisappearanceKnowledgeCounterexample,
  compileDeclaredInvariantKernel,
  compositionCounterexample,
  fairArchitectureBaselines,
  runIndependentCounterexamples,
  speculationBoundary,
} from './independent-semantics.js';
