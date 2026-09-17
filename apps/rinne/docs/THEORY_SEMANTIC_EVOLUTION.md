# Semantic evolution and historical interpretation

## Status and acceptance boundary

Source of truth at task start: develop `d293f9a0f3fa00bd58c025457bfd03e32a7a9994`, checked 2026-09-18. Branch `work/rrp-semantic-evolution-20260918`, PR #834. The initial acceptance-only commit `3af9b2cf842f4c77bdb692935d62587193b33646` and Draft preceded model/test changes.

This continuation examines schema/rule evolution, mixed-version execution and retention. It does not reopen generic evidence minimization, attestation, privacy or fork-detection debates. No runtime import, game rule, save format, existing gate, main or Production is changed. No scheduler was created.

A denotes a conditional mathematical argument, B executed finite evidence, C an assumption, D a heuristic, E measurement and F an unresolved obligation. Source observations below, synthetic examples and external prior art are deliberately separate. Source keys refer to [the primary-source register](THEORY_SEMANTIC_EVOLUTION_SOURCES.md).

## 1. Compatibility must name the behavior it preserves

A schema version number is a label, not a semantic theorem. A migration may satisfy one contract while violating another:

| Contract | Required preservation | Retained falsifier |
| --- | --- | --- |
| Readability | A specified reader parses a writer's bytes | Parsing an added field does not mean understanding it |
| Round trip | No-edit load/save preserves required information | Rebuilding only recognized fields deletes an unknown field |
| Observation | Named queries agree before/after translation | The same integer interpreted as milliseconds versus microseconds |
| Operation | Translated operations preserve observations, results and future transitions | New early-death operation has no old equivalent |
| Merge | Translation commutes with the specified merge algebra | Learned-skill set converted to its count loses overlap information |
| Cutover | Every accepted pre-cut effect occurs exactly once in the active new representation | Complete base copy with an unreplayed concurrent update |
| Historical verification | Original facts retain their original interpretation and evidence | Applying today's award threshold to yesterday's committed award |

These are obligations, not an assertion that seven independent passing booleans prove a deployment. Their interaction is exercised in one cutover model below. Protocol Buffers explicitly distinguishes wire-safe changes from application compatibility and documents paths that lose unknown fields [S1]. Avro's parsing canonicalization excludes non-parsing attributes, including the logical-type distinction relevant to our unit example [S2]. Neither technology claims that parse compatibility proves arbitrary game semantics.

### Round-trip preservation is insufficient even when it succeeds

Synthetic state `{name:'A', hp:0, dead:true}` is valid under `dead == (hp == 0)`. An old client that reconstructs `{name,hp}` loses `dead`. Keeping `dead` opaquely fixes that no-edit round trip, but an old edit setting only `hp=1` now preserves an invalid state. An isolated name patch is safe for this invariant; an HP patch needs translation or rejection.

This is not a counterexample to correctly specified total lens laws. Lenses describe get/put relationships over chosen domains; validity constraints must be part of those domains or checked separately. The original lens treatment also distinguishes totality from laws on partially defined functions [S3]. Cambria explicitly discusses imperfect cross-version behavior and the possible need to upgrade clients [S4].

## 2. A conditional operation-preservation result

Let two deterministic machines have closed domains D1,D2, transitions T1,T2, result functions R1,R2 and protected observations O1,O2. Let M:D1→D2 translate states and A translate the declared old actions. Assume C:

```text
O2(M(s)) = O1(s)
R2(M(s), A(a)) = R1(s, a)
T2(M(s), A(a)) = M(T1(s, a))
```

All expressions must be defined, transitions must stay in their domains, and denial/enablement must be represented in the result or transition contract. Silent side effects outside these machines are not covered.

**A:** induction on old-action traces preserves the mapped state, protected observation and every operation result. The base is the initial mapping. The transition equation gives the inductive step; the other equations preserve what the observer sees. This is a standard forward-simulation argument, not a new protocol. If the tables faithfully describe a finite closed system, exhaustive checking of these premises supports every finite trace of that system. It does not prove that extracted tables describe arbitrary runtime code.

**B:** `lifeTables()` independently constructs an eight-state old machine and fourteen-state new machine. The finite checker validates closure, totality, unique identities and all 24 old state/action combinations. The old lifetime model embeds into a model that additionally allows early battle death. Its ages 0..3 and generations 1..2 are synthetic, not Rinne gameplay values.

The reverse direction fails. A new fatal operation has a different result than the old idle operation even when the initial visible state matches. Old-to-new simulation therefore does not justify downgrade, old-client writing after new-only actions, or the correctness of target-only states outside the mapping's image.

During authoring, a test first altered a target-only battle-state response and expected the forward check to fail. It did not, correctly: that state was outside the old machine's image. The test assumption was wrong, not the checker. Both the corrected mapped-state test and the target-only non-coverage example are retained. Coverage must be tied to the quantified domain rather than an expected green/red label.

## 3. Operations and replica merge need separate algebra

For a mergeable state, additionally require:

```text
M(x join1 y) = M(x) join2 M(y)
```

The tests check the complete four-state powerset over two skill IDs. Converting a set to its count and merging counts with `max` fails: `{a}` and `{b}` each map to 1; merging before conversion gives 2, after conversion gives 1. Converting to a two-bit membership mask and using bitwise OR passes all 16 pairs.

This is a homomorphism requirement, not a CRDT discovery. Snapshot equality alone cannot establish it. Successful forward simulation and merge preservation still do not cover arbitrary target-only actions, removal semantics, garbage collection or a new common-ancestor representation.

Migration paths also matter. Converting 155 cents directly to an integer-cent target preserves 155. Going through a whole-unit representation that rounds down yields 100. Every intermediate value typechecks. Either pin the migration path, prove coherence of the permitted paths, or retain enough complement information to recover the discarded fraction. The example does not allege a bug in Cambria, F1 or another implementation.

## 4. Online conversion is a history-preservation problem

`cutover.mjs` models ONE trusted semantic owner with two physical formats: integer coins and integer milli-coins. It is not a distributed election, membership or cross-domain transaction implementation.

Persistent state contains the active format, semantic revision, two key/value rows, normalized operation receipts, local operation log and migration state. Volatile state contains queued local writes and callback tokens. Only local state and one event enter `transition()`; no remote disk, global alive set, future event, or remote-copy primitive is available.

A local `request` queues work; a separate `flush` event performs a conditional atomic local transaction. The migration has explicit stages:

1. Capture a stable local source snapshot at revision B. This local transactional snapshot is a C storage assumption, not an atomic copy to another node.
2. Materialize each row separately in a shadow representation. Ordinary accepted source writes append local log records after B.
3. Replay each post-B record once, in contiguous revision order, after the rows exist.
4. Seal the source at revision C. Admission of new old-format writes stops; an already queued write must recheck this at its durable effect boundary.
5. Activate only after all rows exist, replay reaches C and the source revision still equals C. The local active pointer and complete target change atomically. A delayed base-copy callback cannot overwrite replayed updates.

Normalized semantic request identity and its original receipt remain stable across encoding changes. A retry with 1 old coin and one with 1000 new milli-coins are the same operation, not two effects. New raw old-version requests after cutover are rejected; this reference does not claim indefinite old-client interoperability. Fractional new coins are deliberately unsupported by its operation algebra.

### Conditional cut argument and its limits

**A under C:** materializing the exact B snapshot establishes the representation relation. If translating each successive logged operation preserves that relation, induction through the contiguous log reaches the exact source state at C. Blocking intervening writes and atomically selecting that target preserves the relation at activation. Keeping old receipts prevents an encoded retry from becoming another effect. The theorem depends on the codec's domain and all accepted operations being represented in the log.

**Next attack:** valid old integers need not fit new units. Multiplication by 1000 can leave JavaScript's exact safe-integer domain. A base row may fit while a concurrent increment makes its translated tail overflow. This was found by source inspection during the loop; both cases now have executable regressions and the `unchecked-range` negative control actually reproduces failure. The model records `target-number-range` and refuses activation. It neither rounds away protected value nor claims that a blocked migration will eventually complete.

A blocked migration discovered after sealing remains closed in this reference. Safe abort/unseal, range-extension adapters and production recovery policy are F. Process restart retains completed local transactions and drops incomplete writes; it does not model storage loss, torn atomic transactions, hostile storage or endless failure. Fixed local keys avoid pretending that concurrent insert/delete membership was covered.

### Independent oracle

The oracle imports no implementation, encoder or normalization helper. It independently computes expected coin values, distinct operation identities and original receipts. The scheduler constructs observations from the returned local state, rather than trusting a node-provided `safety()` flag or claimed view. Oracle state never flows into the node. Exploration fingerprints retain the oracle's historical summary so already accepted effects are not forgotten when states are deduplicated.

This remains an executable specification with trusted harness and JavaScript semantics. It is not a proof assistant, full language-level information-flow proof, malicious-node auditor or validation of browser storage.

## 5. Historical facts must not silently acquire today's meaning

A record accepted with `award-v1` at threshold 4 and score 5 was awarded. A new threshold 6 would deny a new score-5 request. Both answers can be correct because they answer different questions: original decision versus present entitlement.

The reference looks up the named historical interpreter. Missing or malformed interpreters produce UNKNOWN, not automatic denial and not fallback to the current rule. It does not authenticate the registry: stable rule-artifact availability and trust remain C/F. Adding a rule ID to a record alone solves neither.

For Rinne, the candidate representation is original immutable decision material plus a derived view under a named current policy. A sanctioned reinterpretation or compensation is a new explicit event, not a concealed rewrite. A projection may evolve without claiming that the past decision itself changed. This is an architectural proposal, not a production event-store migration implemented in this PR.

### Retention limits future rules

Let K compact histories and Q be the declared future verification queries. An exact reader of K exists for Q only if each q in Q is constant on every fiber of K:

```text
K(h1) = K(h2)  implies  q(h1) = q(h2).
```

**A:** necessity follows because identical retained inputs must produce the same answer. For sufficiency, define the answer on each image value using any representative; fiber constancy makes that well-defined. This is an information-preservation argument, not a new hash or consensus theorem.

**B:** retaining only `ended=true` answers an old ended query for both natural and battle death. A later battle-specific reward separates the two histories, so exact retrospective computation from that summary is impossible. Retaining the cause makes that toy query answerable. A default cause would invent a fact; it could only be an explicitly new allocation policy.

If every predicate over history is permitted as a future query, exact retention must distinguish every pair of histories. Compression can exploit redundancy, but a genuinely non-injective summary cannot provide that universal guarantee. Thus a history garbage-collection policy must name the verification vocabulary it preserves. We do not propose retaining all game history forever: archive size, privacy, query needs and interpreter retention must be selected explicitly.

## 6. Actual Rinne observations, not synthetic bugs

At the start SHA, the inspected source blobs are:

- `src/coop/history.js`, `aaba57a8454575646d69aadd48b73127a1972c29`: imports the current `LIFE_SECONDS`, `validateLife` and `lineageRecord`; its structural history rule ties ended status to lifespan and protects prior lineage/rebirth operations.
- `src/rebuild/domain.js`, `90dc1fd32cbabfef20b8e28286b02baccdcea9b8`, lines 203–207: `endLifeEarly` marks a life ended without making its age equal the lifespan. This is a differing semantic boundary worth classifying. We have NOT proved that this transition reaches the co-op history validator in normal gameplay, and do NOT claim a reproduced co-op defect.
- `src/coop/history-store.js`, `8e8aba8c8f3a7de1332488faeb424ed14337558b`: the version-2 envelope validates structure/hash and commits through current history rules. The shown envelope does not carry an explicit historical interpreter artifact. A format version/hash alone therefore does not establish durable historical interpretation. Existing local/trusted-host limitations remain unchanged.

These source observations motivate a per-semantic-namespace migration contract. They do not authorize changing death behavior, lifespan, lineage, save data or compatibility in the live game. Actual runtime extraction and adapter verification remain F; this PR's execution is of the research model, not these imported runtime modules.

## 7. Fair prior-art comparison and cost

The result is mainly known forward simulation, lens/update translation, homomorphism, schema rollout and information preservation applied to game semantics. F1 treats online schema evolution with explicit multi-version premises [S5]; InVerDa/BiDEL studies coexisting bidirectional schema versions [S6]. This reference does not reproduce their full systems or claim a stronger theorem.

Matched baselines must receive the same semantic split and migration freedom: Canon-only Raft plus versioned state-machine migration; CRDT plus a verified merge-preserving translation; a trusted owner with snapshot-plus-log catch-up; and bidirectional views where their update contract is adequate. The local owner model is a member of that baseline family, not an RRP-specific advantage.

Charge base-copy bytes, operation-log/delta bytes, retained old interpreters, temporary double storage, retry work and the cutover admission pause. Indefinite dual-writing also costs work and needs a correct mixed-version contract. More timestamps, roots or schemas do not imply fewer bytes. Which rollout is cheaper remains E, with the same accepted history and correctness requirements on each candidate.

## 8. Reproducible evidence and stopping boundary

From repository root, without dependencies:

```sh
node apps/rinne/scripts/reality-semantic-evolution-proof.mjs \
  apps/rinne/docs/evidence/RRP_SEMANTIC_EVOLUTION_20260918.json
```

[Machine-readable evidence](evidence/RRP_SEMANTIC_EVOLUTION_20260918.json) records all source hashes, failures and bounds.

| B evidence | Result | Scope |
| --- | --- | --- |
| Focused tests | 30 passed, 0 failed | Synthetic algebra and local migration |
| Guard removal | 9/9 killed by expected invariant failures | Rows, catch-up, late copy, duplicate delta, receipt retention, units, old writer, old rules, numeric range |
| Start-state exploration | 16,000 states / 35,350 transitions; completed depth 8 | State-budget cutoff; **no activated state reached** in this search |
| Snapshot-plus-tail exploration | 1,333 states / 3,053 transitions; depth 12; 82 activated states | Depth cutoff after an explicit 8-event seed prefix |
| Crash positions | 21/21 | Every crash cut of one 20-event trace, followed by an explicit fair local completion |
| Syntax / architecture | Pass | Seven JS files checked; module boundary and local-input tests only |

The two searches and directed tests are separate evidence, not an unbounded composition proof. The first search's lack of activation is disclosed rather than hidden in a large state count. Single-fault enumeration does not cover every combination of all original RRP failure modes.

Environment: Node v22.16.0, Linux x64, isolated repository-like authoring workspace. No checkout was found and ordinary git failed GitHub DNS. `context:plan`, `npm ci`, repository-wide gates, the original `reality-architecture-proof.mjs`, Node 24 and browser/WebRTC/device checks were not executed. No screen changed and no image/video was captured. Tests really ran locally; Ready CI is not substituted for them.

A closes conditional old-trace preservation, the cut argument and the retention boundary. C covers the semantic abstraction, correct codec, local atomic storage and named historical interpretation. D covers rollout/retention policy choices. E covers actual resource/latency costs. F includes real Rinne state/action extraction, target-only semantics, multi-owner rollout, concurrent membership/insert/delete, abort-after-seal, finite retention of receipts/interpreters and machine-checked refinement.

The useful remaining design is **versioned preservation obligations for actual operations and retained questions**, not a universal `compatible=true`. No new protocol is named and no universal speedup is claimed. This is a substantive research/model handoff, not theory saturation; a new action, query or codec reopens its exact obligation rather than restarting all earlier debates.
