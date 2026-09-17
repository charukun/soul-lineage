# Obligation compiler falsification continuation

## Status

Start source of truth: develop `5526851df4ec2a75270bcf55c54667fbfeb579c6` on 2026-09-17. That develop already contains the prior thought-synthesis loop. This continuation treats its surviving `action precondition -> conservative evidence -> rights -> escalation` architecture as a hypothesis under attack, not a conclusion.

No new protocol name is introduced. The current residual candidate is still a **game-specific compiler/control plane built from known mechanisms**. This loop narrows what such a compiler would have to prove and exposes new impossibility/complexity boundaries.

Evidence classes remain:

- **A**: conditional theorem/proof under explicit premises, including published theory delegated with its original model.
- **B**: bounded executable evidence from the isolated branch model.
- **C**: trust/failure/environment/compiler premise.
- **D**: engineering heuristic/optimization.
- **E**: physical/performance measurement.
- **F**: unresolved proof/refinement/composition obligation.

Executable evidence: `../scripts/reality-obligation-compiler-model.mjs`, `../tests/reality-obligation-compiler.test.mjs`, and `../scripts/reality-obligation-compiler-proof.mjs`. These files are research-only and are not imported by runtime game code.

## Loop 1: minimal evidence has an information lower bound

### Hypothesis attacked

If an action only needs a small predicate, its evidence capsule can always be made small.

### Exact one-way equality counterexample

Let node A know an n-bit value `x`, node B know `y`, and let B need an **exact deterministic** answer to `x == y` after receiving one evidence summary from A. If A sends fewer than n bits, fewer than `2^n` distinct summaries exist. By the pigeonhole principle two different values `x != x'` share a summary. For B's local value `y=x`, the executions `(x,x)` and `(x',x)` then produce the same received summary but require different answers. Therefore the summary must be injective and needs at least n bits.

This is a narrow **A** result for deterministic one-way exact equality, consistent with the communication-complexity framework introduced by Yao (source I1). It is not a lower bound for randomized/computational protocols. A fixed cryptographic digest can reduce bytes only by changing the model: equality becomes computational/probabilistic under collision-resistance assumptions rather than information-theoretic exactness.

**B:** the executable model checks the pigeonhole boundary for n=1..8.

### Consequence

An obligation compiler cannot promise that `minimal evidence << state` universally. Some predicates intrinsically require large communication under the selected exactness/trust model. The compiler must expose the guarantee model: exact, randomized-error, computational, or trusted-authority.

## Loop 2: finding the minimum evidence set is itself computationally hard

For a finite declared world set, call a field set sufficient if it distinguishes every safe world from every unsafe world. Selecting a minimum such field set is a covering problem.

Reduction from Set Cover:

1. create one safe baseline world with every evidence field zero;
2. create one unsafe world for each universe element `u`;
3. evidence field `f_j` is one in unsafe world `u` exactly when set `S_j` contains `u`;
4. selected fields distinguish the safe baseline from every unsafe world iff the corresponding sets cover every universe element.

Thus exact minimum evidence-field selection contains Set Cover as a special case. Karp's Set Cover NP-completeness result supplies the known complexity boundary (source I2). The reduction above is the bridge to this compiler problem.

**A:** under this encoding, an exact polynomial-time optimizer for arbitrary finite instances would yield one for Set Cover.

**B:** the model constructs and solves a bounded example by exhaustive subset search.

### Repair

Safety does **not** require globally minimum evidence. A conservative superset of sufficient evidence remains safe if its values and freshness are valid. Therefore:

- soundness/completeness of required dependencies is a correctness obligation;
- minimum byte selection is an optimization;
- greedy/heuristic/approximate evidence selection may be **D** without weakening safety;
- measured byte/latency benefit remains **E**.

This removes an unnecessary requirement that the compiler solve a hard optimization problem before it can be correct.

## Loop 3: negative facts cannot be learned from silence

### Counterexample

A local node has received no claim for a unique sword. Two asynchronous executions are locally identical:

- world A: no remote claim exists;
- world B: a remote claim exists, but its message is delayed.

Any deterministic local decision based only on the identical history must be the same in both worlds. Therefore `no claim message received` cannot prove the global negative fact `no claim exists`.

This is an **A-style indistinguishability argument** under unbounded asynchronous delay; it is not a quantum or metaphysical statement.

Mutation `silence-is-absence` authorizes in both compatible worlds and is killed by the invariant test.

### Signed absence proof repair, then next attack

A complete authoritative registry snapshot can turn absence relative to a particular root/epoch into local verifiable evidence. The branch model signs the full toy registry and verifies non-membership relative to that snapshot.

But authenticity is not freshness. A previously valid snapshot saying `sword unclaimed` remains cryptographically authentic after another node claims the sword. A lagging effect sink that has not learned the newer epoch cannot distinguish `old-but-authentic` from `current` using the snapshot alone.

**B:** `staleAbsenceFreshnessCounterexample` retains this witness.

### Retained rule

Negative facts require a **completeness anchor plus freshness contract**, for example:

- online query/quorum to an authoritative index;
- an epoch/freshness discharge from a trusted service;
- a time lease under explicit bounded-clock assumptions;
- or a preallocated exclusive capability that converts absence into positive possession of a right.

No one of these is free. Freshness itself is a communication/trust/liveness obligation.

## Loop 4: capability attenuation is useful, but a token is not a linear physical object

Macaroons provide prior art for bearer credentials with chained-MAC attenuation, contextual caveats, delegation, short lifetimes, external freshness checks, epoch counters and other revocation patterns (source A2). Proof-Carrying Authentication likewise demonstrates proof submission/checking for distributed authorization (source A1).

The branch implements a deliberately tiny **Macaroon-like** chained-HMAC model only to test properties. It is not claimed compatible with or equivalent to production Macaroons.

### Replay counterexample

A client can copy bearer credential bits. If an effect sink treats possession of a valid single-use token as consumption, two copied requests can spend the same right twice.

Repair: the sink durably records a nonce/operation id (or equivalent transaction state) and rejects replay. Mutation `bearer-is-linear` removes that durable replay check and fails.

### Revocation counterexample

A credential remains authentic after its issuer has changed policy. Epoch/freshness validation is separate from signature validation. Mutation `ignore-revocation` accepts a stale authentic token and fails.

Even the normal epoch check has a deeper limit: issuer-side revocation is not instant at an offline/lagging sink. Before the sink learns the newer epoch, the old credential can still be accepted locally. Macaroons explicitly discuss short-lived credentials, freshness constraints, external authoritative state and epoch counters as revocation strategies; they do not make revocation information propagate instantaneously (source A2).

### Lease boundary

Leases are established prior art for time-bounded consistency/authority (source A3). The branch separates three local outcomes under a declared clock-error bound: definitely valid, uncertain, definitely expired. With no bounded relation between local time and the authority's time, expiry is `unknown`, not a proof.

**C:** any safety claim based on real-time expiration must state the required clock/skew/lease-service premises. A local timer alone does not fence an old writer in an asynchronous system.

## Loop 5: proof-carrying evidence does not prove that the policy compiler was complete

### Counterexample

An authority signs a manifest for `claim-item` requiring only `stock > 0`. The actual game rule also requires `curse == false`. In world `{stock:1, curse:true}`, the signed manifest and stock evidence verify perfectly, while the true rule says the action is unsafe.

The signature proves who endorsed the manifest. It does not prove that the manifest contains every semantic dependency.

**B:** `signedIncompleteManifestCounterexample` retains this case. Adding `curse == false` repairs the toy case, but not arbitrary source extraction.

This sharpens the trust boundary of Proof-Carrying Authentication/PCC-style thinking: proof checking can be small and mechanical relative to a logic/policy, while correctness of the policy and its mapping from the application remains a separate trusted/refinement obligation (source A1).

### Rule evolution

Every obligation proof must bind a `ruleRoot`/compiler-policy version. After semantics change, an old proof capsule cannot authorize a new-rule action merely because it was valid when minted. Mutation `ignore-rule-root` is killed.

A version root still does not certify compiler soundness. For Rinne, proving `runtime rules/effects -> conservative obligation manifest` remains **F**.

## Loop 6: independently valid domain capsules do not form a transaction

### Partial commit counterexample

Suppose an irreversible game operation touches `inventory` and `lineage`. Each domain can issue a locally authentic PREPARE receipt. Applying only the inventory receipt before lineage commits yields a partial irreversible state.

Mutation `local-commit-is-global` deliberately treats one local prepare as global commit and fails.

### Version-composition counterexample

Even two authentic prepare receipts can be incompatible if one domain changed after preparing. The branch binds a local version to each prepare and rejects application after an intervening mutation. Mutation `ignore-prepared-version` is killed.

This is not a new transaction protocol. Distributed transaction commit is established theory. Gray/Lamport describe Two-Phase Commit and Paxos Commit as commit/agreement mechanisms with different failure behavior (source T2); Skeen analyzes nonblocking commit (source T1).

### Deeper attack: decision is not instantaneous visibility

Even after a valid joint commit decision exists, domain A may apply before domain B. The branch retains this counterexample: A is updated while B is still old. A global commit certificate is therefore a **decision**, not magically simultaneous physical application.

The required mechanism depends on semantics:

- **atomic commit decision:** transaction-commit protocol such as 2PC/Paxos Commit under its premises;
- **atomic read visibility:** a transaction/isolation mechanism; RAMP is relevant prior art for read-atomic multi-partition visibility (source T3);
- **safe decomposition:** transaction chopping can expose concurrency only when its conflict conditions preserve serializability (source T5);
- **compensable long-lived workflow:** Saga semantics use compensating transactions (source T4);
- **already-observed irreversible external effect:** compensation is a new history and cannot make observers never have seen the original effect.

The executable Saga witness consumes a unique token, publishes a lineage notification, then compensates with a replacement token and retraction. Business state may be amended, but the historical observation is not erased.

### Rinne consequence

A cross-domain game action must declare which atomicity notion it actually needs. If the action's semantic truth is one Canon event, local/rendered projections may converge after that decision. If two external irreversible sinks must appear simultaneous to all observers, the requirement is much stronger and may be incompatible with an asynchronous, partitionable implementation without changing the semantics or centralizing the visible commit boundary.

## Loop 7: the obligation object is now a typed contract, not a bag of evidence

The surviving research shape becomes stricter:

```text
Obligation(a) = {
  action + operation identity,
  ruleRoot / compilerRoot,
  exact required predicate,
  evidence guarantee model: exact | randomized | computational | trusted,
  conservative dependency evidence + freshness,
  capability/right + replay state + revocation/freshness contract,
  domain read/prepared versions,
  required atomicity class: local | commit-decision | read-atomic | serializable | compensable,
  trust/failure/clock premises,
  chosen known protocol/service for any escalated obligation
}
```

The object is useful only if each consumer verifies the parts it relies on. A signed blob whose effect sink ignores the generation/version/replay/transaction fields is not a proof-carrying system.

### Node-local feasibility

The branch model uses only local sink/domain state plus supplied proof/certificate objects. It never grants nodes an oracle for global liveness, current remote storage or future delivery. Global test code may construct adversarial worlds to demonstrate indistinguishability; that is an observer, not a node capability.

## What changed in the theory candidate

The previous candidate optimized `minimal evidence`. This loop weakens that claim deliberately:

1. **correct conservative evidence comes first; minimal evidence is optional optimization**;
2. evidence size has real communication lower bounds for some predicates;
3. exact global minimization is computationally hard in general finite models;
4. negative facts require authoritative completeness + freshness, not silence;
5. capabilities require sink enforcement, replay protection and revocation freshness;
6. signed proofs require a separately trusted/proved rule-to-obligation compiler;
7. cross-domain obligations require an explicit transaction/visibility semantic class rather than local certificates ANDed together.

This is stronger because it claims less.

## Known-theory equivalence and novelty status

- communication lower bounds -> communication complexity / Yao;
- minimum field selection -> Set Cover complexity;
- proof submission/authorization -> Proof-Carrying Authentication;
- attenuated delegated credentials/revocation patterns -> Macaroons/capability literature;
- time-bounded authority -> leases;
- cross-domain commit -> transaction commit / Paxos Commit / Skeen;
- atomic visibility -> RAMP;
- compensating workflows -> Sagas;
- serializable safe decomposition -> transaction chopping.

None of those mechanisms is new to RRP. The only possible residual novelty remains an integrated **Rinne rule/effect compiler that emits conservative typed obligations and selects/deploys known mechanisms correctly**. Its source-to-obligation soundness, composition correctness and advantage over an equally optimized baseline remain **F/E**. No new name is justified.

## Executed B evidence

Authoring workspace command:

```sh
node reality-obligation-compiler-proof.mjs evidence.json
```

Results on Node v22.16.0 / Linux:

- focused tests: **17 passed / 0 failed**;
- mutation controls: **7/7 killed** by invariant assertions:
  - `silence-is-absence`;
  - `bearer-is-linear`;
  - `ignore-revocation`;
  - `local-commit-is-global`;
  - `ignore-prepared-version`;
  - `ignore-rule-root`;
  - `signed-is-complete`;
- source SHA-256 hashes are recorded in `evidence/RRP_OBLIGATION_COMPILER_20260917.json`.

The tests also retain non-mutation counterexamples for stale authenticated absence, lagging revocation propagation, incomplete signed manifests, joint-decision/partial-visibility gaps, and non-erasing Saga compensation.

This evidence is **B only**: finite deterministic examples, not unbounded model checking, a production cryptographic system, a transaction implementation, or a benchmark.

## Stop boundary for this loop

### Theory closed or reduced

- exact deterministic one-way equality can require n bits for n-bit remote input (**A under stated model**);
- minimum sufficient finite evidence-field selection contains Set Cover (**A reduction**);
- silence cannot establish a global negative fact under arbitrary message delay (**A indistinguishability argument**);
- copyable credentials need sink-side state or another trusted non-replay mechanism for single-use effects (**A model argument, B mutation witness**);
- local prepare proofs do not imply cross-domain atomic commit/visibility (**A distinction, B witness**);
- a signature authenticates a manifest but does not establish that the manifest captures all game semantics (**A logical boundary, B witness**).

### Delegated known theory

Communication complexity, Set Cover complexity, proof-carrying authorization, Macaroon credential patterns, leases, transaction commit, RAMP, Sagas and transaction chopping retain their published assumptions. This branch does not re-prove their full theorems.

### F: still theoretical/implementation work

- sound effect language for all Rinne protected effects and extension points;
- machine-checked `runtime rules -> obligation manifest` refinement;
- trustworthy rule/compiler roots and update process;
- capability issuance/transfer/revocation across offline devices;
- dedupe/replay-state garbage collection without resurrecting old rights;
- dynamic membership and cross-domain transaction composition;
- policy selection without an offline oracle;
- Byzantine/rational adversary model for peer-held rights;
- proof that all real effect sinks enforce every obligation field.

### E: measurement

Actual WebRTC bytes, proof/certificate sizes, online freshness latency, storage writes, cryptographic CPU, battery, failure/retry amplification, commit/visibility latency and benefit versus equally optimized Raft/transaction/capability baselines.

The loop stops here because the newly exposed unresolved items require either a larger source-language/refinement model or physical implementation evidence. They are not relabeled as solved, and a passing finite suite is not a saturation certificate.
