# RRP reconstruction: contract, architecture and residual obligations

Companion to [the adversarial loop record](THEORY_RECONSTRUCTION.md). Classes A–F have the definitions in that report. Primary reference keys are in [the baseline register](THEORY_RECONSTRUCTION_BASELINES.md) and [observation note](THEORY_RECONSTRUCTION_OBSERVATION.md).

## Formal contract of the replacement reference

1. **Premises (C):** a fixed odd configuration, cooperative crash-fault replicas, authenticated configuration-bound messages, deterministic finite-JSON commands, and local transactional durable writes. Fixture keys are public deterministic TEST keys, never deployable credentials.
2. **State:** persistent ballot counter, per-slot promises/accepted records, certified chosen records, applied prefix, command receipts, application relations/generation, recovery manifest and quarantine flag; volatile campaign, pending writes and observed ballot round.
3. **Failures:** arbitrary delay/loss/duplicate/reorder; crash/restart; pause/resume; explicit local storage loss; concurrent proposers. Nodes cannot inspect the schedule. Storage loss quarantines an identity that has forgotten promises. Reliable detection of such loss/non-rollback incarnation is a required external storage contract, not a capability inferred from an empty disk.
4. **Invariants:** one chosen value per slot; contiguous hash-linked applied prefix; no application without historical majority acceptance; nonnegative balance; valid unique lineage child and parent; stable request result; monotone policy generation; no voting after forgotten promises; no snapshot-complete before verified replay.
5. **Safety (A delegated, B implementation):** under Paxos premises [C2], phase-1/phase-2 intersection plus durable promises force later chosen proposals to preserve earlier choices. Induction extends this per slot; deterministic prefix interpretation preserves the specified toy invariants. This is an argument about the abstraction. Refinement from all JS transitions to the published algorithm is **F**, not established by AND-ing component pass flags.
6. **Liveness (C/B/F):** progress needs an eventually stable proposer, a responsive durable quorum, fair timers/storage completion/delivery and enough retained recovery data. Tests supply a finite fair suffix. Unbounded fair-schedule liveness is not proved here. FLP forbids the stronger deterministic fully-asynchronous guarantee [L1].
7. **Cost:** basic per-slot Paxos has two quorum phases, record-sized payloads, signatures/certificates and unbounded retained history in this reference. It is intentionally inspectable, not a fastest implementation. CPU, framing, retransmit and recovery amplification must be measured. No hard millisecond SLA is inferred.
8. **Lower bounds:** intersecting knowledge across decisions, sufficient recoverable information, and physical communication delay are retained. A q certificate proves past acceptance, not that q nodes are alive now. An f-loss budget does not reset at each receipt; correlated or repeated erasures before repair can exhaust it.
9. **Counterexamples:** all six removed safeguards fail the independent oracle. Two-domain crash loss closes a minority; a lost voter never silently rejoins. Unsupported membership changes fail closed rather than pretending to be safe.
10. **Known equivalent:** fixed-membership basic Paxos plus a deterministic state machine, durable idempotency and authenticated evidence. Not a newly named consensus family.
11. **Feasibility:** runs with Node built-ins and explicit message/storage adapters. A browser port needs WebCrypto, durable transaction semantics and WebRTC framing/backpressure; the model does not establish those adapters. No game runtime, save schema, production endpoint or existing gate is modified.

## Architecture decision for Rinne

The unit of strong consistency should be a **conflict/invariant domain**, not necessarily an entity, tick or entire world. This is a design choice constrained by the game's actual dependency graph, not a proof that all domains remain small. Consistency policy can depend on current rights, causal reads and invariant context, not a permanently fixed operation-type label. Consensus may protect authority/configuration/rights transitions as well as ordinary values; those transitions still need a composed proof.

Realtime prediction/interpolation/rollback and interest filtering may remain local/provisional. Proven mergeable facts may use CRDT/monotone dissemination; scarce rights require a correct escrow allocation or coordination. Irreversible effects must validate their causal inputs, request identity, rules version, parent facts and authority generation, then use a known consensus kernel or an explicitly trusted external transaction service. A peer committee can preserve the no-mandatory-dedicated-game-server DEV requirement, but cannot promise availability while a quorum sleeps or durability after all relevant devices are lost.

**Important refinement:** "realtime is discardable" fails when an irreversible death or reward depends on a transient combat result. Consensus can faithfully commit an unjustified death. A recovery/decision capsule needs enough causal read versions, rule/provenance evidence and receipts to revalidate the irreversible effect. A payload digest is not that semantic validation. The exact capsule for Rinne's combat/lineage rules is **F**, not implemented by the toy credit/life grammar.

Authority is an effect capability, possibly distributed by domain or preallocated rights, not necessarily one globally privileged process. History may be a causal DAG with ordered conflict components. Recovery reconstructs an accepted semantic prefix, not every animation or an entire Cartesian world. On crossing a dependency boundary, reconcile before the affected irreversible operation; do not globally freeze unrelated reversible activity by default.

Live voter rotation must use a known joint-reconfiguration/state-transfer protocol with explicit old/new quorum obligations [C1/C7]. The reference deliberately excludes it. Valid snapshots are not admission tickets: freshness, uncommitted accepted values, promises, configuration and incarnation all matter. Byzantine cheating likewise requires a trusted authority or a genuinely Byzantine fault/membership model; signatures alone do not turn three peers into PBFT.

## Evidence, coverage and reproducibility

Run from repository root, without installing dependencies:

```sh
node apps/rinne/scripts/reality-reconstruction-proof.mjs \
  apps/rinne/docs/evidence/RRP_RECONSTRUCTION_20260917.json
```

The runner hashes all source/test files, runs focused tests, reruns them with each safeguard removed, explores two state spaces, executes 72 seeded adverse schedules and audits the replica/oracle dependency boundary. The oracle has a separately written application interpreter and consumes execution observations; it does not call the implementation's `safety()` or use its quorum threshold. Sharing serialization/hash primitives is a remaining trusted boundary, not an independently verified cryptographic library.

| Evidence B | Actual result | Limit |
|---|---|---|
| Focused contracts | 27 passed, 0 failed | Toy commands, fixed configuration |
| Quorum/fence/dedupe/parent/recovery/generation removal | All six killed by invariant assertions | Mutation sensitivity, not mutation completeness |
| Accepted-quorum search | 1,200 states / 2,284 transitions; completed depth 4 | State-budget cutoff; not all depth-5 paths |
| Recovery search | 356 states / 733 transitions; depth 6 | Depth-bound cutoff |
| Seeded combined failures | 72/72 fair continuations, 36 adverse steps each | Samples, not exhaustive combinations |
| Architecture check | Dependency boundary and indistinguishable-local-input tests pass | Not a full language-level information-flow proof |

The search's global scheduler state includes oracle history when deduplicating states; dropping that history could merge a safe-looking state with a state that already violated agreement. Its general exploration allows a bounded fault budget per path; directed tests separately combine multiple faults and multi-stage policy changes. No claim covers the Cartesian product of all listed failures.

Validation environment: Node v22.16.0, Linux, fetched-file workspace. No checkout was available; normal git failed DNS. Therefore `context:plan`, `npm ci`, repository-wide fast validation, the existing legacy `reality-architecture-proof.mjs`, Node 24, browser synthetic and physical WebRTC tests were **not executed**. This independent architecture runner is not falsely presented as those commands. No screenshots/video: no rendered application changed or was exercised. CI, merge, DEV deployment and notification are not local evidence.

## Residual obligations and stopping rule

| Classification | Closed or remaining obligation | What would discharge or refute it |
|---|---|---|
| A | Local indistinguishability; conditional quotient induction; restricted copy bound and its coded counterexample | Check premises/arguments; not a device benchmark |
| A delegated | Paxos/Raft foundations, FLP/CAP boundaries, I-confluence/CALM | Preserve exact published models and prove adapter refinement |
| C | Durable-before-ACK transactions, genuine identities, complete rule dependencies, eventual fair quorum | Explicit platform/trust contract; storage rollback is not an ordinary crash |
| D | AOI padding, error budgets, relay choice, switching thresholds | Calibrated data plus conservative fallback |
| F | Live membership, cross-policy state translation, all-sink capability fencing, game decision capsules, cross-domain transactions, dedupe GC, Byzantine/Sybil resistance | A single composed model and refinement proof, with counterexamples and unbounded invariants; not AND of local suites |
| E | NAT/TURN reachability, SCTP/backpressure, sleep/resume, durable-store latency, CPU/signature cost, battery, dense-room traffic, p95/p99 commit and recovery | Matched-baseline real transport traces and physical devices |

There is no verified universal new protocol and no established general novelty claim. The research candidate is an integrated, game-specific compiler from causal/invariant/observation contracts to conservative replication and capability obligations. Known theory explains the current mechanisms; novelty remains **F** until a residual result is defined and compared to prior work.

This session stops at a reviewable reconstruction artifact, **not theory completion**. A finite checklist cannot exclude a counterexample one step beyond the explored horizon, and complete automatic future-equivalence checking for unrestricted programs is undecidable (see the reduction in the observation note). Any new rule, storage assumption, adapter or failure trace reopens the corresponding obligation. The unresolved theoretical work above is explicit; it is not relabeled "needs real hardware" to force an artificial stopping condition.

Primary reference keys are defined in the two companion notes. Nothing in this status authorizes a Production rollout or a merge by this implementation session.
