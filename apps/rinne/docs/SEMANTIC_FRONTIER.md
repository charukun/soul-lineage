# RRP Semantic Frontier

## Proof target

This follow-up asks a harder question than Canon Nucleus: can the architecture be generalized far enough that, for a declared workload and fault/trust envelope, it is never worse than the relevant known baseline strategies it contains, while still preserving their required safety semantics?

The target is not a physically impossible claim that one fixed protocol is strictly best at every point. CAP/FLP-style trade-offs and lower bounds must remain explicit. The target is a compositional frontier: encode known strategies as feasible policies, classify operations by semantics, account for policy-switch overhead, and choose the minimum-cost feasible plan. A proof may claim weak dominance only when every compared baseline is itself a selectable feasible plan; strict improvement requires a heterogeneous workload where composition saves more than its switching overhead.

Acceptance requires comparison against authoritative-server snapshot/prediction, deterministic lockstep/rollback, state synchronization, crash-consensus replication, RedBlue/eventual/CRDT-style coordination avoidance, full-mesh peer quorum, and an optional Byzantine-authority policy. Missing trust infrastructure must make the corresponding requirement infeasible rather than silently weakening it.

The proof must retain impossibility counterexamples, including partition cases where strong consistency and availability cannot both be guaranteed, asynchronous crash cases where termination cannot be guaranteed without added timing/failure-detector assumptions, and workloads where a single baseline is already optimal and therefore can only be matched, not strictly beaten.
