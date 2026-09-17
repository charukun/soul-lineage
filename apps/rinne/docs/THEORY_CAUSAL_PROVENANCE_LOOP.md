# Causal provenance falsification continuation

## Acceptance contract

Start source of truth: develop `f55d0d77fa891d019ac8463da81ac62ad9a6c764` on 2026-09-18.

This loop is orthogonal to the already integrated evidence-minimization, capability, transaction, compiler/firewall, accountability/rollback, replayability, privacy, and randomness-fairness loops. It attacks the question: **what evidence is needed to explain why a protected Canon fact happened without confusing serialization order, wall-clock order, logical causality, semantic dependency, or provenance truth?**

Required attacks:

1. A total log order proves causal dependence.
2. A vector/happened-before relation proves semantic causation.
3. Equal final snapshots imply equivalent causal histories for all audit questions.
4. A signed provenance DAG proves its inputs/dependencies were complete and true.
5. Wall-clock timestamps can substitute for causal edges under ordinary distributed clock skew.
6. Recovery/revalidation must replay the whole world rather than the causal closure of the protected fact.
7. Arbitrary linearization of independent actions is harmless when later semantic logic observes order.
8. Provenance can be reduced to a single parent pointer for multi-input/multi-policy decisions.

Known Lamport/vector-clock, provenance, partial-order and causal-debugging theory retains priority. Any surviving Rinne contribution must be an explicit semantic provenance contract or placement rule, not a renamed causal-consistency protocol.

Evidence classes remain A/B/C/D/E/F. Research-only docs/model/tests may be added under `apps/rinne`; no runtime import, gameplay/save-schema/protocol change, quality-gate weakening, main or Production change is in scope.