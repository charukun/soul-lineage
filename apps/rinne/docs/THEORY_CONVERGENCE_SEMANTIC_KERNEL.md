# RRP convergence: semantic kernel and fair-baseline closure

## Acceptance contract

Source of truth at task start: develop `d23c28671a221a5fc39f81c56af99ea32e6e5beb` on 2026-09-18.

This task does not search for another isolated theorem. It tries to close the gap between the already-integrated theory and a deployable Rinne architecture by answering one compound question:

> What is the smallest real semantic surface that must receive strong coordination/evidence in current Rinne, what may remain replaceable/provisional, and under equal semantics does that split have a defensible cost advantage over strong-all-state baselines?

The work must use current Rinne code rather than invented inventory/reward domains, identify concrete protected effects and their dependency/authority boundaries, construct a small executable candidate that preserves those effects while treating realtime state as provisional, and compare it against equally optimized baselines using the same workload and guarantees.

Counterexamples take priority. Any claimed advantage must disappear when the workload contains no replaceable state or when the strong baseline is allowed the same compression/batching. Known event sourcing, state-machine replication, escrow/CRDT, reference-monitor, CQRS/checkpointing and consensus theory retain priority. No new protocol name is presumed.

A/B/C/D/E/F evidence classes remain separate. Model coefficients are not physical performance. The output must explicitly state the exact remaining measurements or runtime refinement obligations required before claiming practical superiority.

Research/model code only unless a runtime change becomes unavoidable to validate the architecture. No main/Production write, no scheduler, no CI polling.
