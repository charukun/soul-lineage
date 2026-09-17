# Independent RRP reconstruction and falsification

## Acceptance contract

Start source of truth: develop `97d6c5015f2241f97646c5aa1df386478c26d8ba` (2026-09-17).
PR #716 is currently open/Draft at `df678cb59f42f0ec5502663febfe641e75f2549f`; its conclusions are hypotheses, not inherited proofs. This task does not modify that PR, main, Production or runtime game rules.

The review must separate (A) conditional mathematical results, (B) bounded model evidence, (C) assumptions, (D) heuristics, (E) physical measurements and (F) unknowns. A passing finite checklist is not theory completion.

Required deliverables:

- Refutations with replayable counterexamples, including uncertainty after client disappearance, stale authority/policy chains, non-atomic recovery, and composition boundaries.
- A node-local transition model consuming only persistent/volatile local state and delivered messages; the adversarial scheduler and independent observer are not capabilities of nodes.
- Focused validation, bounded exploration, independent invariant checking and sensitivity to quorum/fencing/dedupe/parent/recovery/generation mutations.
- Primary-source comparison giving Canon-only Raft and other known hybrids the same semantic split, batching, topology and failure assumptions; no designer-weighted victory claim.
- Observation/identity/causality abstractions with formal invariants, counterexamples and explicit relation to known theory. Quantum physics supplies constraints, not faster-than-light communication or quantum hardware assumptions.
- A classified residual-obligation ledger, including composition proof, physical WebRTC evidence, storage durability and hostile-peer limitations. Ready denotes a reviewable research/model change, not a proved production protocol.

This file will contain the findings and link to executable evidence before review handoff.
