# Accountability / hyperproperty falsification continuation

## Acceptance contract

Start source of truth: develop `ccae8251e7b9c687f8e4a8cef375af465ed63124` on 2026-09-17.

This continuation deliberately leaves the prior compiler/firewall axis unless it intersects a new boundary. It studies three orthogonal questions:

1. Which required game guarantees are single-trace safety properties that an inline semantic firewall can prevent, and which are hyperproperties/liveness properties that require cross-observer evidence or fairness assumptions?
2. If a peer host is malicious, can Rinne weaken prevention to cryptographic accountability such as fork detection, append-only proofs, gossip or external witnesses without pretending the host is honest?
3. Can rollback/storage corruption be detected after a device restores an old locally valid snapshot without a non-rollback external anchor?

No new protocol name is introduced. Known hyperproperty, fork-consistency, transparency, end-to-end and self-stabilization theory retain priority. Research-only model/tests may be added under `apps/rinne`; no runtime gameplay, save schema, main or Production changes are in scope.

Evidence classes remain A theorem/argument, B bounded executable evidence, C assumptions, D heuristics, E measurement, F unresolved.
