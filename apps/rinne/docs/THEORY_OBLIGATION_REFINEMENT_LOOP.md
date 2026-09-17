# Obligation refinement falsification continuation

## Status

Start source of truth: develop `969fe256af64034c140bb751a793e403024c926c` on 2026-09-17. The prior loop is merged and remains recorded in `THEORY_OBLIGATION_COMPILER_LOOP.md`. This continuation attacks the largest remaining F item from that loop: whether arbitrary runtime rules/effects can be compiled soundly into a conservative Obligation manifest.

No new protocol name is introduced. The working candidate is deliberately reduced when existing program-analysis, compiler-verification, proof-carrying and reference-monitor theory already owns the mechanism.

Evidence classes remain:

- **A**: conditional theorem/proof under explicit premises, including delegated published theory.
- **B**: bounded executable evidence from the isolated research model.
- **C**: trust/failure/environment/policy premise.
- **D**: engineering heuristic/optimization.
- **E**: physical/performance measurement.
- **F**: unresolved proof/refinement/composition obligation.

Executable evidence:

- `../scripts/reality-obligation-refinement-model.mjs`
- `../tests/reality-obligation-refinement.test.mjs`
- `../scripts/reality-obligation-refinement-proof.mjs`
- `evidence/RRP_OBLIGATION_REFINEMENT_20260917.json`

These files are research-only and are not imported by runtime game code.

## Loop 8: exact protected-effect discovery is not computable for arbitrary Turing-complete action code

### Hypothesis attacked

A compiler can inspect arbitrary game action code and always return the exact set of protected effects/dependencies that the action may use.

### Direct halting reduction

Assume a total analyzer `E(P)` that answers exactly whether program `P` can execute protected effect `emit()`.

For any machine/program `M` and input `x`, construct action `A(M,x)`:

```text
simulate M(x)
if simulation halts:
  emit()
```

If `E(A(M,x))` says `emit` is reachable, then `M(x)` halts. If it says unreachable, `M(x)` does not halt. Therefore an exact total analyzer for this unrestricted language would decide the halting problem.

This is an **A** result for the stated unrestricted model. Rice (source P1) supplies a broader classic undecidability boundary for non-trivial semantic properties; this branch does not claim that Rice by itself proves every intensional effect-analysis statement.

### Consequence

The previous F goal, interpreted as "machine-check arbitrary JavaScript and always recover the exact protected effect/dependency set", is too strong.

At least one of these must change:

1. restrict the policy/effect language;
2. accept a sound over-approximation and possible false positives/`unknown`;
3. require trusted declarations or proofs;
4. enforce effects dynamically at a complete mediation boundary;
5. or combine these.

Abstract interpretation (P2) and effect systems (P3) are established ways to compute conservative approximations. They do not promise perfect precision for arbitrary programs.

## Loop 9: runtime traces and manual annotations cannot be the safety authority

### Trace counterexample

The bounded model contains a rule:

```text
if level > 10:
  require stock > 0 and curse == false
else:
  require stock > 0
```

Tracing only a low-level sample records reads of `level` and `stock`, not `curse`. A later high-level world with `curse=true` takes the unobserved branch.

Mutation `trace-is-complete` treats the observed trace as the complete dependency set and is killed by the witness.

This is not an argument against tracing. Tracing is useful **D/E** evidence for hot-path optimization, prefetching and coverage, but absence from observed executions is not a universal proof of semantic absence.

### Annotation counterexample

A developer annotation can declare only `inventory.claim` while the actual body/hook also invokes `lineage.append`. The annotation is a statement, not a proof that runtime behavior cannot exceed it.

Mutation `annotation-is-authority` retains this mismatch.

### Repair

Tracing and annotations may propose a provisioning plan, but they cannot define what a protected sink is allowed to accept. If an undeclared effect is actually attempted, an independent enforcement boundary must still see it.

## Loop 10: invert authority — the sink owns policy; the caller only supplies evidence

### Hypothesis attacked

A signed/caller-supplied manifest can define both the effect and the requirements for authorizing that effect.

The previous loop already showed an authentic manifest can omit `curse == false`. This continuation changes the architecture rather than trying to make arbitrary caller extraction perfect.

### Sink-owned contract

For each protected effect `e`, the enforcing sink uses an active policy artifact that owns:

```text
ProtectedEffectContract(e) = {
  policyRoot,
  required predicate,
  required evidence schema,
  external oracle/freshness requirements,
  capability/right class,
  atomicity class where relevant
}
```

The caller/compiler may send evidence, proofs and a proposed capability, but cannot weaken the sink's predicate by omitting a field from its own manifest.

The bounded model reproduces the failure:

- caller manifest says only `stock > 0` and returns `ALLOW`;
- sink policy says `stock > 0 && curse == false` and returns `DENY` for `curse=true`.

Mutation `manifest-defines-policy` is killed.

### Missing data becomes availability, not authorization

The sink verifier has three local outcomes:

- `ALLOW`: its own active policy is satisfied;
- `DENY`: supplied authoritative evidence contradicts the policy or the policy root/effect is invalid;
- `ESCALATE`: required evidence/oracle freshness is missing or stale.

This changes the role of the Obligation compiler. If the compiler forgets to prefetch `curse`, the operation may become slower or unavailable, but it does not become silently authorized if the sink itself still requires `curse`.

This is the largest reduction in the previous F burden: **source-to-provisioning completeness is no longer a safety theorem for mediated effects; it becomes primarily an availability/efficiency property.**

The reduction is conditional on the stronger C/F premises below: the sink policy must actually encode the intended safety rule, and every protected effect must pass through that sink boundary.

## Loop 11: nested hooks cannot amplify authority

Dynamic callbacks are a direct attack on a top-level manifest. An action authorized for `inventory.claim` may invoke a plugin/hook which then tries `lineage.append`.

The model repairs this with attenuation:

```text
childAllowed = parentAllowed ∩ requested
```

A nested hook can receive less authority than its caller, never more. Under the safe gateway, the inventory claim succeeds and the lineage append is denied. Mutation `nested-authority-amplification` deliberately lets the child mint the requested set and is killed.

This is capability/reference-monitor territory, not a new protocol. It also does not prove that every real callback path in Rinne is currently mediated.

## Loop 12: complete mediation becomes the non-negotiable safety boundary

The sink-owned-policy repair fails completely if protected state can also be mutated through a raw API, hidden SDK call, alternate adapter or direct storage write.

The bounded model exposes the distinction:

- safe sink facade does not export the raw commit primitive;
- unsafe facade exports it and an unauthorized `lineage.append` bypasses the gateway.

Mutation `effect-sink-not-exclusive` retains the bypass witness.

This is the reference-monitor/complete-mediation boundary described in prior work (P7/P8). It moves the hard proof target from "understand all possible application code perfectly" to a smaller structural claim:

> Every operation that changes a protected semantic resource is mediated by the enforcing gateway, and no untrusted path can mutate the resource behind it.

That claim can still be hard, especially across browser storage, networking, persistence adapters, plugins and future extension points. It is now the correct F target.

## Loop 13: a caller/source hash is not a policy root

A caller action can remain byte-identical while the authoritative effect policy changes. The bounded witness keeps caller source constant while policy registry v2 becomes v3 by adding a new condition. The caller hash stays equal; the policy artifact root changes.

Mutation `caller-root-is-policy-root` is killed.

### Repair

The authorization root must commit to the semantics the sink actually enforces, not merely the code that requested the action.

At minimum, the policy artifact root needs to cover the restricted policy/effect schema and any static oracle contract metadata that defines authorization meaning. Compiler versioning may also be bound where generated target artifacts are trusted.

A root cannot hash live external truth into permanence. Ownership registries, time, membership and other changing facts remain explicit oracle/freshness obligations.

## Loop 14: external facts remain explicit oracles, not hidden local dependencies

The toy `inventory.claim` policy requires an ownership oracle at minimum epoch 7.

The safe verifier returns:

- missing oracle -> `ESCALATE`;
- stale epoch -> `ESCALATE`;
- fresh epoch 7 -> `ALLOW` when local evidence also satisfies policy.

Mutation `undeclared-oracle-is-local-fact` retains the gap between missing and fresh evidence.

This preserves the previous loop's negative-fact/freshness result while relocating the requirement into the sink-owned policy artifact. The compiler may optimize when/how to acquire the oracle proof, but it cannot erase the requirement.

## Loop 15: translation validation helps only after the semantic boundary is restricted

A restricted policy DSL can be compiled to an executable predicate. The branch's toy compiler has a mutation that drops the final conjunct. A bounded translation validator compares source and target behavior over the finite supplied worlds and detects the mismatch.

Mutation `skip-translation-validation` retains the faulty translation.

Translation validation is established prior art (P4); verified compilation such as CompCert (P6) shows a stronger semantic-preservation route for a defined source/target semantics. Proof-Carrying Code (P5) likewise moves checking to the consumer relative to a stated safety policy.

The important boundary is what none of these techniques grants for free:

- they do not discover the intended game policy from arbitrary behavior;
- they do not prove unmodeled FFI/browser/network side effects are absent;
- they do not make a wrong source policy become the right one;
- they do not remove the need for a complete mediation boundary around protected effects.

Therefore the plausible Rinne route is not "verify arbitrary game JavaScript is equivalent to an inferred manifest". It is:

1. author protected-effect policy in a restricted, explicit artifact;
2. generate/compile small glue where useful;
3. validate or verify that translation;
4. mediate every protected effect at runtime against the active policy artifact;
5. use static analysis/tracing/annotations only to provision evidence/capabilities efficiently.

## Reconstructed candidate after this loop

The previous object mixed two roles: describing what an action needs and deciding what is safe. They are now separated.

```text
PolicyArtifact(e) = {
  effect identity,
  policyRoot,
  authoritative predicate,
  evidence schema,
  oracle/freshness schema,
  capability/right class,
  atomicity class,
  trust/failure/clock premises
}

ProvisioningPlan(a) = {
  conservatively predicted effects,
  evidence/oracle prefetch plan,
  requested attenuated capabilities,
  selected known mechanisms,
  optimization hints
}
```

Execution rule:

```text
provisioning plan may be incomplete
        ↓
effect is actually attempted
        ↓
complete-mediation gateway identifies the effect
        ↓
active sink-owned PolicyArtifact is checked
        ↓
ALLOW | DENY | ESCALATE
```

A false negative in the provisioning compiler must not bypass the gateway. Under that premise it costs latency/liveness, not safety.

### What remains strong consistency work

This does not remove the prior transaction problem. A compound semantic operation that spans multiple protected effects may need its own compound policy/transaction boundary. Per-effect gateways cannot manufacture atomic multi-domain semantics by independently returning `ALLOW`.

## What changed in the theory candidate

1. Exact effect/dependency extraction from arbitrary Turing-complete action code is rejected as a universal requirement.
2. Runtime traces and manual annotations are demoted to provisioning/optimization inputs.
3. Caller manifests no longer define authorization policy.
4. Protected sinks own the policy artifact and return `ALLOW | DENY | ESCALATE`.
5. Dynamic hooks receive attenuated authority and cannot amplify capabilities.
6. The critical proof target becomes complete mediation of protected effects plus correctness of the explicit policy artifact.
7. Caller source hashes are not policy roots; live external truth remains an oracle/freshness obligation.
8. Translation validation/verified compilation apply to the restricted policy/glue boundary, not to magically inferring intent from arbitrary game code.

The candidate is stronger because a whole class of compiler false negatives becomes fail-closed rather than silently unsafe.

## Known-theory equivalence and novelty status

- undecidable exact semantic discovery -> halting/Rice-style computability boundaries;
- sound static over-approximation -> abstract interpretation;
- conservative side-effect descriptions -> effect systems;
- per-translation semantic checking -> translation validation;
- verified source-to-target preservation -> verified compiler work such as CompCert;
- consumer-side safety proof checking -> Proof-Carrying Code / related proof-carrying authorization;
- exclusive enforcement -> reference monitor / complete mediation;
- authority attenuation -> capability-system family.

No item above is new to RRP.

Residual Rinne-specific work is the **choice and engineering of a complete protected-effect surface, explicit policy artifacts for game semantics, and integration with the prior evidence/capability/transaction machinery without centralizing unrelated game state**. That is an architecture/refinement problem, not a new distributed-computing theorem.

## Loop 16: the real Rinne surface confirms that persistence is not authority

The abstract model was then checked against the current `apps/rinne/src` implementation at starting develop `969fe256af64034c140bb751a793e403024c926c`.

The inspected paths separate into materially different semantic classes even when they all use storage or networking:

### Replaceable projection / realtime state

`game/reality-lab/replication.js` carries presence snapshots guarded by epoch, term, sequence and checksum, but its receive path updates per-observer `views`; it is a projection/repair mechanism, not a durable lineage commit. Ordinary movement in `rebuild/coop-world.js` likewise advances mutable world state continuously before a history checkpoint is durable.

These writes/messages are not automatically protected canon merely because they cross a network or mutate memory.

### Local single-player persistence

`story/controller.js` saves the main single-player story to `localStorage` only while a browser lock from `story/save-lease.js` is held, and `game/story-save.js` validates the snapshot's life/story/world invariants. That is meaningful local durability and corruption/concurrent-tab protection, but it is still the player's own device acting as authority. It is not evidence of a distributed authenticated canon.

`online.js` also persists a random player identifier in `localStorage`; persistence there is identity convenience, not proof of authorization.

### Shared trial-world structural history

The strongest currently live semantic choke point is the co-op history path:

- `coop/menu.js` constructs `createHistoryStore` over the platform storage adapter and a per-world Web Locks exclusion boundary;
- `coop/history-store.js` reads the previous committed envelope inside the exclusive section, fences world epoch, binds `writeId` to an `intentHash`, runs `appendHistory`, writes a root-hashed envelope and read-backs an ambiguous failed write;
- `coop/history.js` rejects world-clock rollback, player deletion, mutation of sealed rebirth requests, mutation of sealed lineage, resurrection/rewriting of ended lives and rebirth without a committed ended predecessor;
- `applyRebirthIntent` binds the transition to `playerId + lifeId + villageId`, requires the exact ended life to exist in both live and committed state, and records an immutable result id;
- `coop/session.js` rejects stale message epochs and only returns a rebirth result after persistence;
- `coop/checkpoint-writer.js` projects the prior committed life while a life-id/end-state transition is not committed, separating canon-sensitive transitions from ordinary simulation progress.

The store explicitly advertises `cloud:false` and `authenticatedAuthority:false`, while `history.js` explicitly states that host-attested progress is not proof of honest gameplay. The live code therefore already contains an important trust-boundary admission: this is strong **local structural history**, not Byzantine/global truth.

### Reality-lab canon

`game/reality-lab/canon-nucleus.js` is a research/lab quorum model. It should not be counted as a production authority merely because stronger canon semantics exist there experimentally.

### Consequence

"Protected effect" cannot be defined as `storage.write`, `localStorage.setItem`, network send, or any other low-level I/O primitive. The same primitive can carry disposable projection state, local user-owned save state, metadata, or irreversible shared history.

The executable witness `io-primitive-is-policy-key` models this semantic gap. A generic I/O firewall either blocks harmless operations or must reconstruct the domain semantics it was supposed to avoid inferring.

The enforcement boundary must therefore be a **semantic choke point**: the lowest layer shared by all irreversible paths that still retains enough domain meaning to enforce the intended invariant.

For the currently inspected co-op path, `history-store.commit -> appendHistory` is much closer to that boundary than raw platform storage.

## Loop 17: complete mediation is a property of the authority graph, not one wrapper object

The real co-op path also exposes a stronger attack on the earlier "hide the raw sink" model.

`createHistoryStore` closes over a raw `storage` object and does not return it. That is useful encapsulation. But `coop/menu.js`, which constructs the store, still has access to `getPrepared().platform.storage` and legitimately uses it for `coop-last` metadata, resume tickets and legacy migration.

Therefore "the protected store wrapper has no raw method" is insufficient as a proof of complete mediation. The relevant property is:

> no component holding a raw storage/network capability can use it to mutate a protected semantic namespace or external side effect except through the policy-enforcing path.

In the inspected files, the canonical v2 history key prefix is private to `history-store.js`, while direct menu writes target metadata/ticket keys. That is encouraging but is not yet a repository-wide proof: connector code search did not provide a complete index, and platform/package internals were not exhaustively audited.

The next implementation proof should therefore operate on the **capability/dependency graph and protected namespaces**, not on class/interface shape alone.

## Loop 18: effect names are too coarse; rights must bind parameters and intent

The previous toy gateway attenuated a set of effect names. The real rebirth code shows why that is insufficient.

A right to `life.rebirth` for player `p1`, life `p1:2` must not authorize rebirth of player `p2`, life `p2:7`. The bounded mutation `effect-name-is-authority` demonstrates exactly this failure: name-only equality authorizes the second request while a parameter-scoped right rejects it.

The live co-op path already contains two useful patterns:

- `applyRebirthIntent` fences a request by `playerId`, exact `lifeId`, optional `villageId`, committed predecessor and immutable `resultId`;
- `history-store.commit` makes a repeated `writeId` idempotent only when its `intentHash` is identical, rejecting reuse of one operation identity for a different payload.

The capability shape must therefore be closer to:

```text
Right = {
  effect,
  subject/resource constraints,
  argument constraints,
  operationId,
  semantic intent digest,
  generation/freshness,
  delegation caveats
}
```

Attenuation is logical narrowing of that predicate, not string-set intersection. This is established capability/caveat territory; RRP novelty is not claimed.

## Loop 19: a valid policy root is not proof that the policy is current

Sink-owned policy removed one class of compiler unsoundness, but introduced a rollback question.

The bounded model has policy v2 allowing `inventory.claim` for `{stock:1, curse:false, age:3}` while v3 adds `age > 6`. Both policy roots are internally valid. An offline sink that still treats v2 as active authorizes an operation the current v3 policy denies.

Mutation `policy-root-is-fresh` is killed by requiring the policy root to be fenced by an active policy epoch/generation.

This is the same authenticity-versus-freshness distinction already found for absence proofs and credential revocation:

- a hash/root proves content identity;
- it does not prove that the content is the currently authorized semantics.

The live co-op code already uses the analogous generation pattern for world authority: restored worlds increment `epoch`, history commit checks the expected epoch, and the host rejects inbound messages carrying a stale epoch.

A future policy artifact should therefore bind to an authority/policy generation. An offline node may continue only when an explicit lease/capability says the older semantics remain valid; otherwise irreversible commits must fail closed or escalate.

There is one optimization opportunity: if a restricted policy language can prove that an old policy is strictly more restrictive than the current policy, executing under the old policy can remain safe but may reject newly legal actions. That implication check is an optimization/refinement problem, not the default trust rule.

## Loop 20: `ALLOW` cannot float free between check and commit

The prior gateway model returned `ALLOW`, then let a sink act later. That has a classic stale-permit gap.

Bounded counterexample:

1. `stock=1`, version 1; policy check returns `ALLOW`;
2. another operation consumes the stock and increments version to 2;
3. a naive sink accepts the old `ALLOW` permit and commits anyway.

Mutation `permit-outlives-state` is killed by binding the permit to the state version and rejecting commit when that version no longer matches. Revalidating inside the same exclusive transaction is equivalent in spirit.

The current co-op history path already demonstrates the stronger shape locally: `history-store.commit` acquires the per-world exclusive boundary, reads the previous committed state, checks epoch/idempotency/history invariants and performs the write while still inside that boundary. `checkpoint-writer` snapshots the mutable world before asynchronous I/O rather than persisting a live object.

Therefore the reconstructed rule is:

> policy/evidence validation and irreversible state transition must share one serializable/atomic commit boundary, or the authorization result must be version-fenced and revalidated at commit.

For external oracles, the permit also needs a freshness guarantee that remains valid through commit; a local version alone cannot fence remote truth.

## Loop 21: the compiler is now a preflight optimizer in front of semantic commit firewalls

After the abstract falsification and the concrete Rinne path inspection, the candidate can be narrowed again:

```text
Action code
  -> ProvisioningPlan (soundness desirable, incompleteness tolerated)
       predicted semantic effects
       evidence/oracle prefetch
       parameter-scoped requested rights
       likely atomicity class
  -> actual semantic command(effect, args, operationId, intentDigest)
  -> semantic commit firewall
       active PolicyArtifact(root + generation)
       sink-owned predicate
       current/versioned local state
       fresh required oracles
       parameter-scoped capability
       replay/idempotency state
       transaction/atomicity contract
  -> ALLOW+commit | DENY | ESCALATE
  -> projection/replication afterwards
```

This is materially different from the original "compile arbitrary runtime rules into a complete authorization manifest" idea.

The compiler is still valuable: better prediction reduces `ESCALATE`, evidence bytes, remote oracle queries and latency. But **its false negatives are no longer allowed to create authority**. The semantic commit firewall discovers the actually attempted protected command and applies the current sink-owned policy regardless of what the preflight predicted.

The architectural center has moved from a clever analyzer to a small number of auditable semantic commit boundaries.

### Current Rinne protected-surface hypothesis

Based on the inspected live paths, not a repository-wide proof:

- **ordinary movement/presence/render projections:** non-canon, replaceable;
- **single-player browser save:** locally durable/user-authoritative, corruption/concurrency guarded, not distributed canon;
- **co-op checkpoint structural history:** protected local shared-history sink, with life-end/rebirth/lineage transitions as the clearest irreversible semantics;
- **co-op metadata, resume tickets and player-id storage:** persistent metadata, not equivalent to lineage authority;
- **reality-lab canon nucleus:** experimental stronger authority, not production surface.

This inventory sharply reduces where the heavy obligation machinery should be paid. It should not wrap every frame, movement update or storage call.

## Loop 22: a JavaScript wrapper is not a tamper-resistant reference monitor when ambient storage authority remains

The platform layer tightens the concrete threat boundary further.

`packages/platform-web/src/index.js` implements the platform storage port by directly calling browser `localStorage`. `packages/platform/src/index.js` validates and freezes the adapter object, but freezing that object does not revoke the browser-global `localStorage` capability. `apps/rinne/src/main.js` also uses `localStorage` directly for unrelated local state, confirming that same-origin application code has ambient access independent of the platform wrapper.

Therefore a private `createHistoryStore` wrapper can provide an excellent **trusted-code correctness boundary**, but it is not a tamper-resistant reference monitor against arbitrary same-origin JavaScript. Code that is already executing with ambient browser authority can write the scoped key directly if it knows the key.

The bounded mutation `wrapper-hides-ambient-authority` captures the structural point: a wrapper can expose no raw method while another holder of the same raw capability still bypasses it.

This forces the threat model to be explicit:

- against malformed/stale peer messages and ordinary implementation mistakes, the current host-side semantic choke point can be meaningful because remote peers do not directly execute storage writes on the host;
- against a malicious/compromised host, injected same-origin script, or deliberately hostile mod running with browser globals, the current browser-local wrapper cannot establish complete mediation;
- a stronger global-canon threat model would require a boundary that the untrusted game code cannot directly bypass, such as a separately isolated trusted component or remote authenticated authority, plus the prior freshness/transaction guarantees.

This aligns with the classic reference-monitor requirement that mediation be not only complete but tamper resistant. It also prevents overclaiming the current co-op design: the code and UI already state that the trial village trusts the host, and the store advertises `authenticatedAuthority:false`.

The architectural result is not "move all gameplay to a server". It is narrower: **choose the smallest semantic authority boundary that matches the adversary actually being defended against.** For today's trusted-host co-op, local structural mediation may be enough. For a future adversarial/global canon, it is not.

## Executed B evidence

Authoring workspace:

```sh
node --test apps/rinne/tests/reality-obligation-refinement.test.mjs
node apps/rinne/scripts/reality-obligation-refinement-proof.mjs apps/rinne/docs/evidence/RRP_OBLIGATION_REFINEMENT_20260917.json
```

Results on Node v22.16.0 / Linux x64:

- focused tests: **20 passed / 0 failed**;
- invariant-sensitive mutation witnesses: **13/13 reproduced**:
  - `trace-is-complete`;
  - `annotation-is-authority`;
  - `manifest-defines-policy`;
  - `nested-authority-amplification`;
  - `caller-root-is-policy-root`;
  - `undeclared-oracle-is-local-fact`;
  - `skip-translation-validation`;
  - `effect-sink-not-exclusive`;
  - `effect-name-is-authority`;
  - `policy-root-is-fresh`;
  - `permit-outlives-state`;
  - `io-primitive-is-policy-key`;
  - `wrapper-hides-ambient-authority`;
- `node --check` passes for model, proof runner and test;
- SHA-256 values for those sources are recorded in `evidence/RRP_OBLIGATION_REFINEMENT_20260917.json`.

This is **B only**. The finite suite does not prove the halting reduction, complete mediation in the real application, policy correctness, production cryptographic security or exhaustive translation validation.

## Stop boundary for this continuation

### A: closed/reduced under stated models

- exact protected-effect reachability for unrestricted Turing-complete action code cannot be a total exact analyzer, by direct halting reduction;
- one execution trace cannot establish absence of dependencies on unexecuted paths;
- caller declarations/manifests cannot establish that runtime behavior has no additional protected effects;
- a caller/source root can remain unchanged while authoritative sink policy changes;
- an enforcement architecture is unsafe if a protected semantic sink has an unmediated mutation path;
- effect-name equality is insufficient for parameter-scoped authority;
- a valid policy root does not by itself prove policy freshness;
- a prior `ALLOW` decision is unsafe after dependent state changes unless the decision is fenced/revalidated at commit;
- low-level I/O identity is insufficient to classify semantic irreversibility;
- hiding a raw sink behind one wrapper does not establish complete mediation while ambient authority remains elsewhere.

### B: bounded executable witnesses

- alternate-branch trace miss;
- underdeclared effect annotation;
- caller-manifest/sink-policy disagreement;
- child authority amplification mutation;
- source-root/policy-root divergence;
- missing/stale/fresh oracle outcomes;
- buggy restricted-DSL translation caught by bounded validation;
- raw protected-sink bypass;
- effect-name-only cross-subject privilege leak;
- stale-but-valid policy rollback;
- stale permit after state-version change;
- identical I/O primitive carrying both replaceable and protected semantics;
- hidden wrapper plus independent ambient raw-authority bypass.

### Concrete repository evidence at the start SHA

The inspected live co-op chain already approximates several repaired invariants:

- `coop/menu.js` creates the history store and serializes host ownership with Web Locks;
- `coop/history-store.js` performs read/validate/write within per-world exclusion, epoch-fences writes and binds write ids to intent hashes;
- `coop/history.js` owns structural lineage/rebirth monotonicity and explicitly disclaims proof of honest gameplay;
- `coop/session.js` epoch-fences inbound commands and waits for persistence before acknowledging rebirth;
- `coop/checkpoint-writer.js` hides uncommitted life-id/end transitions from projected views;
- `story/controller.js`/`story-save.js`/`story/save-lease.js` are a separate local-save authority class;
- `game/reality-lab/replication.js` is projection/repair, not canon commit;
- `game/reality-lab/canon-nucleus.js` remains a lab model.

This is an inspected-path inventory, not a repository-wide complete-mediation proof.

### C: explicit premises

- policy artifacts themselves correctly encode intended game safety semantics;
- evidence/oracle authenticity is enforced outside this toy model;
- active policy root **and generation** are trustworthy/fresh;
- all protected semantic namespaces and external sinks are actually exclusive/mediated across the full capability graph **for the declared adversary**;
- check/authorization and commit share a valid atomic/version-fenced boundary;
- capability/replay/freshness/transaction mechanisms retain the prior loop's stated premises.

### D/E: optimization and measurement

- precision of conservative preflight analysis;
- usefulness of runtime traces/declarations for prefetching;
- evidence/oracle preallocation strategy;
- rate of `ESCALATE` caused by compiler false negatives;
- semantic-firewall CPU/latency/storage cost;
- policy-generation rollout latency;
- WebRTC bytes, storage writes and battery impact versus equally optimized baselines.

### F: next theoretical/implementation work

- complete the repository-wide protected semantic namespace/capability graph and state the adversary boundary explicitly;
- for a trusted-code threat model, prove no unintended path writes the protected v2 history namespace; for a hostile same-origin-code threat model, introduce a genuinely isolated authority boundary rather than relying on a JavaScript wrapper;
- define the restricted `PolicyArtifact` for real life-end/rebirth/lineage commands, including parameter scopes and intent digests;
- bind policy generation to host/authority epoch and specify offline rollout semantics;
- compose the semantic firewall with compound cross-domain transaction classes from the previous loop;
- prove dedupe/replay-state GC cannot resurrect an old operation/right;
- decide whether any future global canon promotion requires authenticated authority beyond the current `cloud:false / authenticatedAuthority:false` local co-op trust model.

The continuation stops here because the remaining uncertainty is no longer mainly abstract-program-analysis theory. It is a bounded implementation/refinement audit of **which real Rinne components possess the capabilities to commit protected semantic history**. The theoretical architecture has converged further: **preflight inference may optimize; only a current, parameter-scoped, version-fenced semantic commit firewall may authorize an irreversible effect.**
