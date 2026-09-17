# Randomness / fairness falsification continuation

## Acceptance contract

Start source of truth: develop `5b5585e0795b9279ace5d731f71431f07b1df3e4` on 2026-09-18.

This continuation deliberately does not revisit already-integrated evidence-minimization, capability, transaction, compiler/firewall, accountability/rollback, deterministic replay, or information-flow arguments except where they form premises for a new result.

Primary question: **even when a random-dependent Canon result is reproducible afterward, was the random choice itself unbiased, unpredictable at the required time, and non-grindable by the authority that selected the seed/input/timing?**

The loop will attack at least these distinct claims:

1. A deterministic seeded replay is evidence of fairness.
2. A host-chosen seed is acceptable if the resulting seed is recorded.
3. Commit/reveal automatically removes host/client bias.
4. A VRF proof makes a random game outcome unbiased regardless of key/input selection.
5. Public-beacon randomness is sufficient without binding the action to an unpredictable future round before the outcome can be chosen.
6. More randomness contributors monotonically improve fairness without introducing abort/liveness leverage.
7. Randomness fairness can be evaluated without separating unpredictability, bias resistance, availability, auditability and grinding cost.

The expected surviving result, if any, must be stated as a placement/contract rule rather than a renamed randomness protocol. Known coin-flipping, VRF, distributed-randomness and threshold-beacon theory retains priority.

Evidence classes remain: A conditional proof/theorem, B bounded executable witness, C assumption/trust/failure model, D heuristic, E measurement, F unresolved.

Research-only model/tests may be added under `apps/rinne`; no runtime import, gameplay/save-schema/protocol change, quality-gate weakening, main or Production change is in scope.