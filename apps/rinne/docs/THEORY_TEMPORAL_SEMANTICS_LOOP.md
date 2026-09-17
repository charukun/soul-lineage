# Temporal semantics falsification continuation

## Acceptance contract

Start source of truth: develop `604339a59cf7eea8a5011545fce72dce54b2651b` on 2026-09-18.

This loop is orthogonal to the integrated causal-provenance, randomness, replayability, privacy, firewall, transaction and rollback axes. It attacks **what “before/after/deadline/expired” means for protected game actions across game time, monotonic elapsed time, wall-clock time and authority-observed time**.

Required attacks:

1. Client-declared send-before-deadline can be trusted without a time authority/attestation.
2. Server receive-before-deadline is semantically equivalent to user action-before-deadline.
3. A finite grace period can make honest pre-deadline actions complete under unbounded delay while still rejecting all post-deadline actions.
4. Authenticated clock synchronization automatically attests when a game action occurred.
5. Game/world time, monotonic process time and UTC wall time can be substituted freely.
6. A retry after a deadline should be re-evaluated as a new action even when it is the same already-accepted operation whose response was lost.
7. Exact timestamps are always preferable to explicit time-uncertainty intervals.
8. Deadline/policy updates need no version binding if timestamps are retained.

Known physical/logical-clock, secure-time, uncertainty-clock and real-time consistency theory retains priority. Any surviving result must be a semantic time contract/placement rule, not a renamed clock synchronization protocol.

Evidence classes remain A/B/C/D/E/F. Research-only docs/model/tests may be added under `apps/rinne`; no runtime import, gameplay/save-schema/protocol change, quality-gate weakening, main or Production change is in scope.