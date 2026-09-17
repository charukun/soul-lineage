# Independent RRP reconstruction: findings and proof boundaries

## Status and provenance

This review supersedes **the strength of the proof/completion claims**, not the gameplay specification, in `CANON_NUCLEUS.md`, `SEMANTIC_FRONTIER.md` and earlier Reality Lab proof reports. Their simulations remain useful illustrations. They do not certify a deployable, composition-safe protocol. No universal RRP superiority, theory saturation, or "only hardware tests remain" conclusion survives this review.

Repository: `charukun/soul-lineage`. Task branch: `work/rrp-independent-reconstruction-20260917`, PR #752. Its GitHub-confirmed start parent is develop `97d6c5015f2241f97646c5aa1df386478c26d8ba`; the initial documentation-only Draft commit is `5ab9c9243fba831591b4d5542b40f95067674587`. A subsequent metadata comparison with develop `e75ecdca9d0074b0ec49ec571129502bb57372da` found only unrelated Integration/CI changes, not changes to the audited RRP files. PR #716 was open/Draft at `df678cb59f42f0ec5502663febfe641e75f2549f`, not the develop implementation. It is a reference under attack, not a dependency or imported proof.

At writeback, the branch had advanced to `c69ba7a8968ed60251f4a6a69d414c78bdbd9a4b` with another model and [reconstruction report](THEORY_RECONSTRUCTION.md). Those existing contributions are retained byte-for-byte; this additional review is not a rerun or certification of their suites. All counts and hashes below apply only to `scripts/rrp-reconstruction/`, its two `reality-reconstruction*` tests and its named runner. The models must not be presented as one composed proof.

Read together: [formal contract, architecture, evidence and open obligations](THEORY_RECONSTRUCTION_CONTRACT.md), [fair baselines and primary sources](THEORY_RECONSTRUCTION_BASELINES.md), [observation/physics/philosophy](THEORY_RECONSTRUCTION_OBSERVATION.md), and [machine-readable evidence](evidence/RRP_RECONSTRUCTION_20260917.json). The executable reference lives in `../scripts/rrp-reconstruction/`; it is **not imported by the game runtime**.

Evidence classes are never interchangeable:

| Class | Meaning in this review |
|---|---|
| A | Mathematical statement with explicit premises and an argument, or a specifically delegated published theorem; not a proof of this JavaScript implementation |
| B | Executed finite cases, bounded exploration or sampled schedules, with scope and cutoffs |
| C | Assumption about failures, storage, authentication, rules or scheduling |
| D | Engineering heuristic, not a guarantee |
| E | Claim that needs a concrete transport/device/workload measurement |
| F | Undischarged proof, adapter, semantic or implementation obligation |

## Adversarial loop record

### 1. Quorum intersection was mistaken for an executable recovery proof

**Hypothesis:** two durable replicas and intersecting quorums suffice to justify the existing implementation model.

**Attack:** develop `canon-nucleus.js` (blob `75c9b26afd1243a14f43e0b794da97cafc551085`) owns a global `nodes` map, reads remote `alive` and durable replicas, and copies replicas to several nodes in one transition. PR #716 `canon-packet-proof.js` additionally validates an ACK by inspecting its sender's actual disk, consults global visible history during recovery, and repairs all survivors atomically. These are source-level counterexamples to the claimed node-local implementation model, not reruns of those old suites.

**Reconstruction:** a replica receives only its local state, one delivered event and its own cryptographic port. A local write is queued, then persisted by a separate event, then acknowledged. Recovery streams individually certified records; apply advances a contiguous local prefix. Only the adversarial scheduler and an independent retrospective oracle can see all nodes. Their state is never passed to a replica.

**Next attack:** an ACK can arrive after its sender crashes. Therefore checking the number of *currently live* holders at publication is not implementable from that ACK. Two executions have identical leader history but differ in a follower crash after signing. The leader must make the same decision in both. **A:** ACK evidence is historical, not a perfect failure detector. **B:** the test forks those two executions and compares identical leader inputs/outputs. Storage/failure-budget assumptions remain **C**, not repaired by signatures.

### 2. Uncertain completion is not repaired by asking the lost client to retry

**Counterexample:** replicas A/B accept X; A disappears before sending a receipt or propagating LEARN. The original client never returns. A replacement cannot infer that X was aborted, and cannot require that client to repair history.

The reference uses a fresh local recovery proposal and Paxos phase 1. It adopts the highest accepted value for that slot, establishes a certificate, and applies X before later slots. A stable request ID maps to the original request and original result/slot on durable replay; ID reuse with another payload is a conflict, not a new operation. A minority-only acceptance may legitimately be superseded. Once chosen by a quorum, it may not be.

**B:** directed tests cover this without the original retry, plus retry after process replacement and retry with conflicting content. **F:** querying a live game's pending command after reconnect, dedupe garbage collection and external side-effect exactly-once semantics still need adapter contracts. Exactly-once *message delivery* is not claimed.

### 3. Policy activation was not monotone

PR #716 `policy-handoff-proof.js`, blob `f34fd0f53ac5963a0331249108ea7740b58f80f3`, unconditionally sets `targetState = clone(fence.state)` on every `activate()`.

Source-derived witness: initial value 1; prepare; persist fence; activate; target writes 10; activate again. Target becomes 1 while the old `safety()` predicate still passes. Another witness chains two independent handoff objects: fencing the second object's source does not close the first object's still-open target writer. Local no-overlap predicates do not imply global fencing.

The reference makes a policy change a command in the same protected log, incrementing one durable generation. It never reactivates by restoring a previous snapshot. The old command's retry returns its original receipt without reapplying it. Later generation checks reject stale new effects. **B:** A→B→C, old activation retry, stale writes, elections and recovery are interleaved in a single directed trace.

**F, deliberately not hidden:** these are logical policy/authority metadata changes over a fixed voter set. They are NOT membership rotation, a CRDT-to-consensus state translator, trusted external-service activation or a complete authorization system. A stale process can keep running; every real effect sink must enforce the committed capability generation. An off-log side effect defeats the entire argument.

### 4. A signed statement is not an invariant proof

Two concurrent instances of the SAME `spend(1)` definition, each starting at balance 1, can both pass locally and merge to -1. Comparing only different operation definitions misses this case. An unsupported effect silently ignored by a checker is worse than no certificate. Duplicate resource IDs can alias two intended constraints.

The independent finite checker rejects unknown fields/effects and duplicate resource/definition IDs. It enumerates a finite common-ancestor domain and two one-invocation branches, including equal definitions with distinct occurrence IDs. Verification recomputes the result and binds the specification hash, checker version, bounds, coverage and witness. Flipping a verdict/coverage/witness fails verification.

**B only:** at most three resources, eight definitions, bound 1–4, one invocation on each branch. A passing result says `no-counterexample-within-bound`; it does not authorize arbitrary JavaScript as coordination-free. General I-confluence/CALM results are known theory [baseline references I1/I2]; applying them to the complete game's rules remains **F**. Conservative refusal to weaken consistency is the fallback.

### 5. The comparison could manufacture a winner

Putting all realtime bytes through baseline Raft but only Canon bytes through RRP proves a workload-selection inequality, not a better consensus protocol. Registering a family's policy set in a larger set proves set inclusion; it does not prove safe switching, online selection, zero translation cost or a physically realizable frontier.

All baselines now receive the same semantic split and optimization budget. Identical plans have identical traffic ledgers regardless of their names. That equality is **B accounting evidence**, not a benchmark of five implemented production stacks. The baseline matrix explicitly includes specialized Raft/CRDT/authoritative/SFU/rollback hybrids. No designer-selected scalar cost coefficient decides the winner.

**Next attack:** a workload can alternate just after each costly migration. Even an optimal plan for the current phase can lose to a fixed plan. An online policy must charge detection, catch-up, fencing, retried work and future uncertainty. A rule such as "switch when estimated benefit over horizon exceeds handoff cost plus margin" is **D**, not offline-oracle dominance.

### 6. The claimed copy lower bound needed a representation assumption

**A, restricted:** if information is stored only as complete copies on independent failure domains, surviving any f erasures requires at least f+1 copies. Fewer can all be erased by an allowed failure set.

**Counterexample to the unrestricted claim:** store two bits x,y as three one-bit fragments x, y, x XOR y. Any two reconstruct the two bits. One-erasure durability uses three stored bits, not the four bits of two full copies. The executable algebra checks every input and missing fragment. This does not show a cheaper consensus commit or eliminate the information needed across a recovery cut. Coding metadata, fragment availability, durability acknowledgements and repair all have costs.

Information-theoretic accounting must consider conditional entropy given a receiver's prior information [O1], not assert that an uncompressed payload size is a universal lower bound. Flexible Paxos also prevents treating "every phase must use a majority" as universal [C4].

### 7. Composed testing broke the replacement model too

The first replacement passed 24 focused tests and six mutation controls. A larger trace added policy commit → uncertain next operation → leader crash → successor recovery → policy change → stale replay → restart → storage loss → interrupted record recovery.

That trace FAILED: a successor with a low ballot repeatedly resent a rejected ballot after receiving NACKs, so an accepted credit was never learned (balance stayed 2 rather than 6). This was a genuine liveness defect in the new model, not a flaw to dismiss as "only real-device behavior". The timer now durably advances its ballot using received NACK evidence, without a remote-state oracle or client resubmission. Fair-timer continuation then passes. A second attack added domain-closure checking to the observation quotient: checking only listed pairs was insufficient if a transition left the listed domain.

The final evidence is 27/27 focused tests, 6/6 invariant-sensitive mutation kills, and the separately bounded explorations in the companion evidence. This history is itself a counterexample to checklist-based completion.

## Decision and completion boundary

Keep the semantic separation, but implement it over a known consensus kernel and explicitly verified dependency/capability contracts. Do not deploy this experimental model as new netcode. The [contract and obligation ledger](THEORY_RECONSTRUCTION_CONTRACT.md) distinguishes proved abstractions, finite evidence, trusted premises, heuristics, measurements and unresolved composition work. Ready means a reviewable research/model change; it does not mean a finished protocol.
