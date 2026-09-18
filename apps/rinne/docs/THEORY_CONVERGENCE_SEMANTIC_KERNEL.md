# RRP convergence: smallest strong Rinne surface

## Result

Task-start truth: develop `d23c28671a221a5fc39f81c56af99ea32e6e5beb` on 2026-09-18. This pass composes the already-merged reconstruction, obligation, accountability, replay, privacy, fairness, provenance, time, attestation and migration results. It does not introduce another protocol name.

The surviving architecture is:

> **Strongly coordinate only semantic facts whose rollback can violate a declared Rinne invariant or later protected decision. Keep broader simulation state provisional under an explicit recovery RPO. Reconstruct protected state from its journal or a journal-derived protected snapshot, never from a provisional checkpoint merely labelled with a valid canon root. Compare only with baselines given the same semantic split and representation freedom.**

RedBlue consistency, I-confluence/coordination avoidance, CALM, consensus logs and event sourcing retain prior-art priority; see [sources](THEORY_CONVERGENCE_SOURCES.md). The residual RRP value, if implementation and measurement support it, is a Rinne-specific contract/refinement and policy-selection toolchain rather than a new consensus theorem.

A = conditional argument, B = finite executable evidence, C = assumption, D = policy/heuristic, E = physical measurement, F = unresolved implementation/proof.

## Current semantic surface

The source-derived manifest is [`evidence/RRP_CONVERGENCE_EFFECT_MANIFEST_20260918.json`](evidence/RRP_CONVERGENCE_EFFECT_MANIFEST_20260918.json).

Current protected effects:

| Effect | Current path | Protected reason |
| --- | --- | --- |
| `player.birth` | add player → persist-before-welcome → `born` history | shared identity must not acquire a second first life after recovery |
| `life.seal` | life ends → dirty history → `life-ended` | committed predecessor must not resurrect or rewrite terminal lineage inputs |
| `life.rebirth` | `applyRebirthIntent` → persist → ACK → `reborn` | generation/lineage extension and request identity must be idempotent |
| `authority.epoch.acquire` | history-store acquire/restore fence | stale authority must not keep writing after a successor epoch |

`lineage.append` is derived from rebirth, not an independent current command.

Movement, position, ordinary HP/stamina, front simulation and presentation are replaceable. Equipment, experiences, skills, defeats, `returns` and `homelands` evolve provisionally during a life but are consumed by terminal lineage/rebirth logic. Under the **current** contract they become protected at the later boundary. If product semantics promise an immediate irreversible homeland unlock or similar reward, that effect must be promoted explicitly.

`FRIEND_PLAY.md` states current DEV trusts the Host, uses local Host storage and permits rollback of recent unsaved gameplay. The candidate preserves that trust envelope rather than claiming cloud/global or hostile-host safety.

## Current code already implements part of the split

`checkpoint-writer.js` separates simulation from persistence, coalesces saves and hides an affected actor's uncommitted lifecycle transition while unrelated actors continue. `session.js` persists rebirth before ACK and rejects stale message epochs. `history-store.js` supplies epoch fencing, stable write identity and failed-write readback.

The remaining coupling is representation: current `coop-v2` durably writes a whole checkpoint plus structural history. Earlier Canon Nucleus research similarly places canon and recovery material in the same modeled strong commit. The convergence candidate separates their durability meanings.

## Candidate architecture

```text
realtime / presentation                     replaceable
        |
provisional simulation
        |
        +--> provisional recovery snapshot  rollback <= selected RPO

protected semantic command
        |
semantic commit boundary
        | policy + epoch + op identity + dependencies
        v
protected journal event/delta               zero protected RPO
        |
        +--> protected semantic snapshot    journal compaction / GC base
        +--> derived protected projection

recovery = provisional checkpoint + protected overlay
```

There are three durability objects:

1. **Protected journal.** Zero rollback for declared protected facts under the selected authority/failure model.
2. **Protected semantic snapshot.** A background, strongly durable snapshot derived from journal replay. It bounds replay/storage and is the only acceptable base for deleting a protected journal prefix.
3. **Provisional recovery snapshot.** Broader gameplay state at a chosen interval. It controls recent gameplay RPO and bandwidth, not protected truth.

Authority is separate. Trusted-host DEV can remain local. Crash-quorum, external or Byzantine authority is selected only for a mode whose threat model requires it. Storage strength also does not prove gameplay honesty: a structurally valid Host can still report a false defeat total, so competitive/global modes need the already-studied replay/witness/attestation mechanisms per effect.

## Event representation

The source-shaped model and live shadow now use:

- birth: protected identity plus an initial actor recovery base, semantic clock floor and the current reconnect token as **confidential recovery material**;
- life seal: terminal protected delta plus one `lineageRecord`, without repeating the previous lineage;
- rebirth: stable intent/receipt, one terminal record and a new actor recovery base without repeating the lineage prefix;
- epoch acquire: authority generation transition and semantic clock floor.

The reconnect token is not public canon. It is required only to preserve the current same-character resume contract when an older provisional checkpoint predates a participant's birth; any future distributed validator design must keep it in a trusted/encrypted recovery channel or change the reconnect contract rather than broadcasting it.

A rebirth delta remains about 1.35 KiB in the synthetic JSON shape through generation 50, while naively repeating lineage grows from about 1.7 KiB to 18.6 KiB. A conventional event-sourcing/Raft implementation may use the same representation, so this is not an RRP-only advantage.

## Recovery counterexample and repair

A first design bound a provisional checkpoint to a valid `(baseSeq, baseRoot)` and replayed only later journal events. That is unsafe:

1. the checkpoint can name a genuine prefix root;
2. a protected field such as `seed` or `homelands` can nevertheless be stale/corrupted in its payload;
3. no later event need touch that actor;
4. tail replay succeeds;
5. the bad field would silently become canonical.

Therefore **a valid canon-root label does not authenticate provisional checkpoint contents**.

The repaired model reconstructs the protected plane from the protected journal, overlays protected fields onto same-incarnation provisional actors, replaces actors across generation changes, removes noncanonical ghost actors and restores rebirth receipts. The `trust-snapshot-protected` negative control breaks this and is detected.

Protected compaction has the same rule. The compacted snapshot is created from journal-replayed protected state, not from a provisional world. It binds its body, base sequence and base root. The finite suite recovers the same final protected state/root from every compacted prefix of a birth → seal → rebirth → epoch → birth trace and detects snapshot-body corruption.

Compaction also cannot silently delete retry identity. The protected snapshot retains operation digests for the supported retry window. Dropping them turns a previously idempotent uncertain retry into a rejection/new-operation risk; the `drop-compaction-dedupe` control is detected. Receipt/dedupe GC therefore needs its own explicit retention rule.

### Conditional recovery argument

Assume C: the journal is complete for the declared effects; event transitions correctly enforce authority, operation identity and semantic preconditions; events contain enough creation/delta material; protected snapshots are derived from and bound to a durable journal prefix before prefix deletion; and the selected hash/signature/consensus mechanism satisfies its declared threat model.

Let `P_i` be protected state after event `i`. If each event interpreter maps `P_i` to `P_(i+1)`, induction reconstructs the unique protected head. Overlaying that head on any valid provisional checkpoint cannot alter the protected result. This does not prove real JavaScript effect-extraction completeness, honest combat, physical durability or liveness.

## Source-shaped extractor

A standalone `shadow-extractor.mjs` now narrows the refinement gap over checkpoint pairs. It:

- ignores movement/HP/current homecoming changes under the current product contract;
- derives natural-lifetime `life-seal`, `rebirth`, `epoch-acquire` and `birth` actions;
- rejects player deletion, same-life lineage rewrite and sealed-record mutation; it now accepts both natural lifespan completion and combat-ended lives as `life.seal`.

That early-death boundary was not merely theoretical. `combat-core.js` and `combat-evolution-runtime.js` call `endLifeEarly` from the same shared-front path used by `CoopWorld.advance`, while the pre-change `history.js` required `ended === (ageSeconds === LIFE_SECONDS)`. The branch repairs that structural mismatch: an ended life must be in phase `ended`; a non-ended life must remain below `LIFE_SECONDS`; an early combat-ended life is sealed and its terminal record remains immutable. A focused co-op history test now commits an early combat death and rebirths from that exact sealed predecessor. This is a runtime correctness fix discovered by the convergence loop, not a change to combat fatality policy.

## Fair cost envelope

Synthetic 30-player JSON sizes:

- whole checkpoint: **25,633 B**;
- protected actor projection: **432 B**;
- full actor creation state: **771 B**;
- birth: **1,285 B**;
- life seal: **879 B**;
- rebirth: **1,356 B**;
- epoch: **86 B**.

Four representative one-actor life-seal commits, one follower:

- whole checkpoint every protected boundary: **102,532 B**;
- actor journal: **3,516 B**;
- fair known event-sourcing baseline using the same semantic split/encoding: **3,516 B**.

Thus:

```text
allStrong      = protectedStrong + replaceableStrong
semanticStrong = protectedStrong
saved          = replaceableStrong
fairBaseline   = protectedStrong
```

With no replaceable traffic, savings are zero. The candidate does **not** beat a fair event-sourcing/consensus baseline on the same protected bytes. The legitimate gain is avoiding unnecessary strong treatment of replaceable state.

A single fixed encoding is also false economy. In this JSON model, 30 life-seal events total 26,370 B, larger than the 25,633 B checkpoint; 29 remain smaller. Rebirth crosses earlier: 18 actor events are smaller, 19 are larger. The finite sweep checks birth/seal/rebirth for all affected counts 1..30 and selects the smaller encoding only when both represent the same protected transition/identities.

## Two independent Pareto controls

For a 25,633 B provisional checkpoint over 60 seconds with one backup copy:

| interval | bytes/min | provisional RPO |
| ---: | ---: | ---: |
| 0.5 s | 3,075,960 | 0.5 s |
| 1 s | 1,537,980 | 1 s |
| 2 s | 768,990 | 2 s |
| 5 s | 307,596 | 5 s |
| 10 s | 153,798 | 10 s |
| 30 s | 51,266 | 30 s |
| 60 s | 25,633 | 60 s |

This is not a recommendation. Once the protected path is small, provisional recovery cadence can dominate bytes and must be selected from physical/user-experience evidence.

For 1,000 representative 879 B protected events, append traffic is 879,000 B. The 30-player protected state is 13,835 B, while the actual compacted semantic snapshot is **16,447 B** because it also binds the base and currently retains a 2,424 B dedupe ledger. Compact every 10 events: replay ≤9, background snapshots 1,644,700 B. Compact every 1,000: replay ≤999, background snapshot 16,447 B. Protected compaction and provisional checkpoint cadence are independent knobs.

## Fair baseline conclusion

The strongest supported conclusion is intentionally narrow:

- strong-all-state designs can waste coordination on state whose rollback the product permits;
- semantic classification can remove exactly that waste;
- a known architecture given the same semantic classification, event representation and consensus mechanism can match the candidate's strong-path lower envelope;
- any further practical advantage must come from the quality of the Rinne-specific effect/refinement toolchain, adaptive representation, operational integration, or measured engineering, not a renamed consensus primitive.

## Implementation path and experiment

### Stage 1: live shadow journal

**Implemented in this branch as non-authoritative runtime instrumentation.** `src/coop/semantic-shadow.js` is attached to the existing successful checkpoint path through `checkpoint-writer.js` and `session.js`. The current `coop-v2` save remains the only authority. After each successful durable save, the shadow independently derives birth / natural life-seal / rebirth / later epoch-acquire transitions from the previous and next committed checkpoints, maintains an in-memory protected journal, and checks that the current history sequence advanced by the same number of lifecycle effects. Movement, HP and provisional reward inputs do not enter the journal.

A shadow mismatch is a **hard candidate failure but not a gameplay failure**: it is retained in diagnostics and does not turn an already successful `coop-v2` save into a failed authoritative write. This is deliberate shadow-mode isolation. The host exposes the result only through a diagnostics method; no player UI, save schema, network protocol or current authority decision reads it.

The first durable checkpoint of a host process is a warm baseline. Therefore a restart's already-completed epoch acquisition is not retrospectively proven by this in-memory shadow. Persistent shadow recovery and restart-to-restart epoch coverage remain Stage 2/F, rather than being hidden behind a green first sample.

Focused runtime evidence added after the research model: the pre-persistence live-shadow core ran 10/10 Node tests; the current branch now contains 14 focused shadow cases including restart anchors and stale-checkpoint birth/rebirth recovery for warm start, replaceable-state exclusion, natural life seal, rebirth, later epoch transition, guest birth, lineage-rewrite divergence, history-sequence disagreement, combat-ended sealing, shadow/live-failure isolation and capture of checkpoint-vs-journal bytes (the last two concerns share the ten-test file). `node --check` passes for the shadow, checkpoint-writer and performance modules plus the focused test in the isolated workspace. A separate exact-history-body fixture, with only domain helpers stubbed, passes 2/2 checks for early combat sealing/immutability and rejection of a living life at the lifespan boundary. The full repository co-op-history test for combat death is added but cannot be executed in this no-checkout workspace because its normal package graph is unavailable. These runtime checks are separate from the earlier 37-test research evidence bundle.

### Stage 2: restart-spanning coverage and source-shaped recovery

**Restart coverage is implemented diagnostically, not as recovery authority.** The Host stores shadow state under `coop-shadow-v1:<worldId>` only after successful authoritative commits. Restore accepts it only when world/owner identity, the exact current `coop-v2` root and history length all match. A missing, stale or malformed file becomes explicit `coverage=gap`; it never blocks game restore or claims the missing interval was checked.

The persisted projection now carries, per current incarnation, a recovery base captured at the bootstrap/birth/rebirth boundary, protected identity/terminal data, the reconnect token, and a protected tick/world-time floor. A pure non-authoritative `recoverCheckpointWithSemanticShadow` overlay can therefore take an older provisional checkpoint, remove ghost actors, materialize a participant born after that checkpoint, cross a rebirth whose predecessor is still in the provisional checkpoint, restore rebirth receipts, and prevent the world clock from moving behind an already protected event. Existing same-incarnation provisional fields are kept where the contract still permits rollback.

Because `CoopWorld` increments epoch on a real restore, an anchored shadow observes the first post-restart `authority.epoch.acquire`. Diagnostic writes are serialized outside the authoritative result; a crash between authoritative save and shadow persistence creates a later coverage gap, never a second source of truth.

The exact-current shadow source was independently probed against birth-over-old-checkpoint and rebirth-over-predecessor recovery, stale-anchor rejection, gap handling and combat-ended sealing. These are source-level finite probes, not the full repository Node 24 gate. **No runtime path uses the recovered shadow checkpoint as authority in this PR.** Promotion still requires an experiment adapter, compaction/GC, receipt-window policy and failover tests before switching the current `coop-v2` recovery source.

### Stage 3: matched physical experiment

The bound plan is [`evidence/RRP_CONVERGENCE_EXPERIMENT_PLAN_20260918.json`](evidence/RRP_CONVERGENCE_EXPERIMENT_PLAN_20260918.json):

1. all-state/recovery material on the strong path;
2. semantic journal + asynchronous provisional recovery;
3. fair known event-sourcing baseline with the same semantic split and quorum mechanism.

Same build/workload/topology/transport, threat model, batching/compression, protected effects and provisional RPO are required. Reuse the repository's existing performance contract and hard safety keys. Existing absolute SLOs remain the only absolute thresholds: frame p95 ≤33.34 ms at physical-device evidence; Host-loss detection p95 ≤4.5 s and reopen p95 ≤6 s at physical-multipeer evidence. Other physical metrics remain calibration-required until a baseline is accepted.

Start with 2–3 real peers on fixed Wi-Fi, then WAN/TURN and 30-device cohorts separately. Synthetic/browser evidence is not promoted to physical evidence.

## Executed B evidence

Run without workspace dependencies:

```sh
node apps/rinne/scripts/reality-convergence-proof.mjs \
  apps/rinne/docs/evidence/RRP_CONVERGENCE_SEMANTIC_KERNEL_20260918.json
```

Current isolated result:

- **37 focused tests passed / 0 failed**;
- **7/7 semantic controls killed**: missing rebirth dependencies, lost rebirth receipt, ignored checkpoint root, trusted provisional protected fields, ignored epoch, compaction from provisional state, dropped compaction dedupe ledger;
- `node --check` passes for core/kernel/cost facade, oracle, extractor, workload, runner and three test files;
- 90 adaptive encoding points pass; lineage-growth counterexample retained;
- provisional-RPO and protected-compaction Pareto curves retained;
- fair event-sourcing baseline matches candidate strong bytes in each tested envelope.

Initial research-snapshot evidence at head `8ea7b6f127f0097e5184c16774d1cd2ad0cace17`: [`evidence/RRP_CONVERGENCE_SEMANTIC_KERNEL_20260918.json`](evidence/RRP_CONVERGENCE_SEMANTIC_KERNEL_20260918.json). Later live-runtime changes are intentionally not represented by those recorded source hashes; their exact Git blobs and executed checks are in [`evidence/RRP_CONVERGENCE_RUNTIME_SHADOW_20260918.json`](evidence/RRP_CONVERGENCE_RUNTIME_SHADOW_20260918.json). Environment: Node v22.16.0, Linux x64, isolated repository-like workspace. No full checkout: `context:plan`, `npm ci`, repository-wide Node 24 gates, original `reality-architecture-proof.mjs`, browser/WebRTC and physical-device tests are not claimed.

## Remaining boundary

A: conditional journal-replay/compaction argument and fair strong-byte algebra.

B: finite source-shaped extraction, independent oracle, mutation controls, recovery/compaction tests, size sweeps and Pareto curves.

C: completeness of the four-effect contract, correct runtime codec/policy generation, local current trust model and declared authority mechanism.

D: provisional RPO, compaction interval, event-vs-checkpoint encoding and promotion of newly irreversible product effects.

E before practical-superiority claims: matched physical bytes/latency/queues/frame/battery, rollback distributions, Wi-Fi/WAN/TURN/device cohorts and the fair baseline in the same environment.

F: promotion of the source-shaped shadow projection/journal to live recovery authority (restart coverage and a pure recovery overlay now exist diagnostically); homecoming/immediate-reward product decisions; bounded receipt/dedupe GC; shadow recovery; stronger membership/hostile-host authority only where required; future schema/policy migration. The early-combat-death/history mismatch is no longer F in this branch: its direct source path is identified and the co-op structural history rule is repaired.

**Theory stop condition:** do not create more conceptual RRP loops just to invent terminology. Reopen theory only when live refinement or physical evidence falsifies this boundary/cost model.

**Practical stop condition:** the stated goal is reached only after the shadow/live implementation passes the hard safety contract and a matched physical experiment quantifies its Pareto point against fair baselines. Until then the architecture is converged, but practical superiority remains E/F.
