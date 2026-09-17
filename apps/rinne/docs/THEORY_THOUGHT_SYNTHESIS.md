# RRP thought-synthesis falsification: action knowledge, resources and composition

## Status

Source of truth at task start: develop `4a3a328e143f92e5c5f297d6d6bac453e4627f36` on 2026-09-17. This task is isolated in PR #766. PR #752 is open/Ready research and is **not** assumed integrated, correct, or composition-safe; its observation/decision-capsule ideas are hypotheses under further attack.

This review adds no new protocol name. The strongest surviving candidate is a game-specific compiler/control plane assembled from known ideas: conservative knowledge/abstraction, explicit action preconditions, resource rights, dependency/local-to-global checks, and a known consensus or trusted transaction kernel when local evidence is insufficient. Whether that integrated compiler is novel, correct for Rinne, or faster than equally optimized hybrids remains **F/E**.

Evidence classes:

- **A**: conditional mathematical result or explicitly delegated published theorem under stated premises.
- **B**: bounded executable evidence from this branch.
- **C**: assumption/trust/failure/environment premise.
- **D**: engineering heuristic.
- **E**: requires measurement.
- **F**: unresolved proof/refinement/composition obligation.

The executable model is `../scripts/reality-thought-synthesis-model.mjs`; it is not imported by runtime game code. Evidence is `evidence/RRP_THOUGHT_SYNTHESIS_20260917.json`.

## Loop 1: epistemology becomes an action gate, not a world snapshot

### Hypothesis

An irreversible action does not require a node to know the complete world. It requires the node to know every fact that is a necessary precondition for that action.

### Formalization

Let `W_i` be the set of worlds compatible with node `i`'s local state and received evidence. Let protected action `a` require predicate `P_a`.

```text
safe-to-act_i(a) only if forall w in W_i: P_a(w)
```

The rule is intentionally universal. One compatible safe world is insufficient. Evidence refines knowledge by shrinking `W_i`; it must never silently drop a feasible world merely because that world is inconvenient.

This is not a new theorem. It is directly aligned with Moses's Knowledge of Preconditions principle: under its runs-and-systems premises, a necessary condition for an action induces a knowledge precondition for that action. See source K1.

### Counterexample

Two local worlds render identically. In one, stock is zero; in the other, stock is one. An existential check sees a world in which `spend(1)` is safe and would execute. The mutation `existential-knowledge` does exactly this and the invariant test fails.

### Repair

Refine by requesting evidence that distinguishes the relevant worlds. In the finite model, a 16-world state has fields `{stock, generation, cosmetic, weather}` while the protected decision depends only on `{stock, generation}`. Exhaustive subset search finds a two-field sufficient evidence set. When a new hidden `curse` rule is added, the old two-field capsule immediately stops determining the decision; the minimum grows to three when `curse` is declared.

**B:** this shows that decision evidence can be smaller than world state in a finite declared model, and that a hidden rule invalidates an old capsule. It does not solve arbitrary-code dependency inference.

### Attack on the repair

A supposedly precise abstract state `{stock=1}` that omitted a feasible `{stock=0}` world fabricates knowledge. The interval test retains this under-approximation counterexample; mutation `trust-underapprox` is killed.

**Retained result:** use conservative over-approximation. Ambiguity may reduce availability; under-approximation can break safety.

## Loop 2: abstract interpretation and counterexample refinement

Cousot & Cousot's abstract interpretation gives the right mathematical direction: compute sound information about concrete computations in an abstract domain rather than copying every concrete state (A delegated, source A1). Counterexample-guided abstraction refinement provides the methodology of starting coarse and adding distinctions exposed by counterexamples (source A2).

For Rinne the useful extraction is:

1. compile a conservative abstract state from declared rule effects and received evidence;
2. check whether the abstract state entails the protected action precondition;
3. if not, request only evidence capable of splitting the ambiguous abstract class;
4. if the language/compiler cannot prove completeness, escalate or fail closed.

This is stronger than "observation frontier = current visibility." A hidden projectile test still has equal current rendering but different next HP. The abstraction must preserve future protected distinctions over its claimed horizon/action grammar.

**F:** a sound abstract interpreter for the actual Rinne rule language and all runtime extension points does not exist here. #752's undecidability boundary still applies to unrestricted programs.

## Loop 3: resource ontology becomes escrow/capability ownership

A philosophical statement such as "existence is relational" does not reduce coordination by itself. A technically useful stronger statement is: some protected actions can be authorized by a locally owned, non-overlapping resource right.

Suppose total scarce capacity is `T` and node `i` has quota `q_i`, with:

```text
q_i >= 0 and sum_i q_i <= T.
```

If a node may only consume its own quota, any concurrent local consumption bounded by each `q_i` preserves total consumption `<= T`. This is a direct arithmetic argument (**A** under authentic, nonduplicable rights). The executable model enumerates the finite spend envelope for an example.

The idea is established prior art, not RRP novelty: escrow transactions and bounded counters partition rights/slack to preserve numeric invariants while allowing local work (sources R1/R2). Separation logic supplies a resource-oriented vocabulary for local reasoning (source R3).

### Counterexample

A right transfer that credits the receiver twice while failing to debit or deduplicate the sender creates authority. Mutation `duplicate-transfer` violates the quota invariant and is killed.

### Boundary

"Linear logic says a token cannot be copied" is **not** a network security mechanism. Classical bits can be copied by a malicious client. Real rights require authenticated identities, durable transfer state, generation/fencing and enforcement at every effect sink. Transfer, replenishment and loss recovery may reintroduce coordination. Rational or malicious users also invalidate a crash-only cooperative model; BAR explicitly distinguishes Byzantine, altruistic and rational behaviors (source T1).

## Loop 4: local truths do not automatically glue into one world

The previous work correctly rejected "component proof A AND component proof B therefore composition safe," but a replacement needs a positive composition criterion.

### Counterexample 1: pairwise consistency without a global world

The executable relation triangle uses:

```text
AB: A=B
BC: B=C
AC: A!=C
```

Every pair agrees on its overlap, yet the natural join is empty. Mutation `pairwise-as-global` treats pairwise agreement as a global witness and fails.

This is known local-to-global theory, not a new RRP discovery. Beeri, Fagin, Maier and Yannakakis show that pairwise consistency does not imply global consistency in general, and characterize acyclic database schemes with strong local-to-global properties (source C1). The finite helper identifies a chain hypergraph as alpha-acyclic and the constraint triangle as cyclic. That helper is only **B** for its implementation; it is not a substitute for the published theorem.

Sheaf-theoretic data integration is a broader mathematical language for compatible local data and global sections (source C2). It is useful as a lens, but saying "use sheaves" supplies no game protocol or consistency proof by itself.

### Counterexample 2: local guarantees with incompatible relies

Two finite components can each satisfy its own local guarantee while each transition violates the other's environment assumption. Mutation `ignore-rely` accepts that composition and fails.

Assume/guarantee specification and composition is established formal-methods territory; Abadi and Lamport explicitly treat environment assumptions and guarantees and note the subtlety of realizability/composition (source C3).

### Retained rule

Before promoting independent domains to a global action, require either:

- a proven local-to-global structural condition for the exact constraint model;
- a checked global join/witness for the affected constraints;
- or coordination across the shared invariant domain.

A cyclic dependency graph is a warning, not automatic proof of unsafety. An acyclic graph is useful only under the theorem's actual relation/consistency premises.

## Loop 5: common knowledge tells us when *not* to build a global barrier

Halpern & Moses formalize distributed/common knowledge and show that, formally, common knowledge is unattainable in practical systems under the relevant temporal uncertainty; weaker attainable variants are studied (source K2). Moses's KoP work further connects simultaneous coordinated actions with common knowledge of necessary preconditions under its assumptions (source K1).

### Bounded epistemic counterexample

The executable three-world acknowledgement model has an actual world where A received B's acknowledgement and B sent it. Both A and B individually know readiness. Yet the transitive indistinguishability closure reaches a world where the initial order was lost, so readiness is not common knowledge.

### Design consequence

Do **not** require world-wide simultaneous certainty for ordinary Canon publication unless the game specification genuinely requires simultaneous coordinated action. Prefer an asymmetric decision authority/certificate with eventual dissemination, or explicit ordered coordination where the action's preconditions demand it.

This is not a way around consensus. It prevents adding a stronger knowledge requirement than the game action needs. If simultaneous multi-agent effects really require common/nested knowledge, the communication obligation returns.

## Loop 6: control theory and information theory separate approximate rendering from protected truth

Shannon's fidelity-criterion result defines a rate-distortion function `R(D)` for a source and distortion measure (source I1). For an equiprobable binary source with Hamming distortion, the executable helper checks the familiar `R(D)=1-H_2(D)` shape on `0<=D<=1/2`.

This supports one narrow design point: **replaceable presentation state may be deliberately approximate when the distortion function represents what the game actually tolerates**. It does not permit an exclusive item to be duplicated with probability `delta` merely because average visual distortion is small.

Data-rate-limited control also has genuine data-rate/stability tradeoffs for specified dynamical systems, including linear systems (source I2). This warns against a universal "send less is always safe" rule: some unstable dynamics require enough timely information for the requested control goal.

The Good Regulator theorem is deliberately **not** interpreted as "every client must model the whole world." Its published statement concerns a regulator that is maximally successful/simple under exact assumptions (source I3). In this game, the relevant regulator objective may distinguish only a quotient/sufficient statistic. Claiming the theorem mandates global state replication would be a category error.

**D/E:** choose prediction horizons, distortion budgets and correction thresholds only from an explicit utility/safety metric and measurements. Protected invariant predicates remain hard constraints unless the game design itself defines probabilistic failure as acceptable.

## Loop 7: failure suspicion is knowledge with imperfect sensors

The old oracle-like `alive` premise is also attacked from failure-detector theory. Chandra & Toueg explicitly characterize unreliable failure detectors using completeness and accuracy and show consensus constructions under detectors that can make mistakes (source F1).

The practical rule is not "learn true liveness." It is "make safety independent of possibly wrong suspicion, and state what eventual detector property liveness needs." A timeout can trigger a campaign or transport change; it cannot itself certify that old authority vanished.

This reinforces #752 rather than creating a new algorithm.

## Loop 8: useful philosophy versus attractive but empty relabeling

The following prompts were tested for executable residue:

| Prompt | Technical residue | Verdict |
|---|---|---|
| Epistemology: what must an actor know before acting? | KoP + conservative possible-world abstraction + evidence refinement | **Retain**; strongest added lens, but prior art |
| Relational/process ontology | Conflict/dependency relations, event identity, resource ownership | **Retain only after formalization**; names alone add nothing |
| Pragmatism/operationalism | Compare states by protected observable consequences and future actions | **Already behavioral equivalence/abstract interpretation**; no separate novelty |
| Category/compositional thinking | Demand maps/interfaces that preserve invariants across composition | **Useful discipline, technically empty until an actual compositional theorem/contract is supplied** |
| Sheaf/local-to-global imagery | Local sections and global compatibility | **Useful for diagnosing gluing**, but database/sheaf prior art; not a protocol |
| Cybernetic Good Regulator | Model distinctions relevant to the control objective | **Reject "sync the whole world" reading** |
| Linear-resource metaphor | Do not duplicate scarce rights | **Retain as proof discipline**, reject as cryptographic/network enforcement |
| Common knowledge as universal finality | Global simultaneous certainty | **Reject as default requirement**; use only when the action semantics demand it |
| Quantum collapse/decoherence | Canon finality/conflict settling | **Still discarded**; no new mathematical consequence |

Whitehead/process philosophy and general category language did not produce a residual theorem in this loop beyond event/relational/compositional formalisms already covered by established computer-science theories. They remain prompts, not architecture primitives.

## Surviving architecture candidate, without a new name

For each protected action `a`, compile an **obligation**, not a full-world snapshot:

```text
O(a) = {
  necessary predicate P_a,
  conservative abstract worlds / sufficient evidence fields,
  causal/dependency inputs and versions,
  owned scarce rights/capabilities,
  authority/rules generation,
  acceptable presentation distortion (if any),
  composition/shared-invariant domain,
  evidence provenance/trust requirements
}
```

Node-local decision sequence:

1. Evaluate only local durable/volatile state plus received authenticated evidence.
2. If the conservative abstract state entails `P_a`, and any required local rights are valid, the action may proceed on the policy authorized for that obligation.
3. If `P_a` is false in every possible world, reject.
4. If worlds disagree, request/refine only evidence capable of distinguishing the decision; do not fetch the whole world by default.
5. If refinement crosses a shared invariant/resource boundary, transfer rights or coordinate through a known kernel/trusted transaction service.
6. If the effect grammar, dependency edge, trust model or composition condition is unknown, fail closed or escalate consistency.
7. Reversible rendering may use a declared distortion/error budget; irreversible invariants may not inherit that relaxation unless the game specification explicitly does so.

This generalizes the earlier "decision capsule" into a **proof obligation about what the actor knows and owns**, but the components are known theory. No novelty label is justified yet.

## What this can and cannot save

Potential communication reduction comes only when the action predicate partitions world states coarsely enough that many concrete distinctions are irrelevant, or when rights are already local. The lower-bound question becomes the information needed to distinguish safe from unsafe decision classes **given the node's prior information**, plus coordination needed for shared rights/constraints. This may be much smaller than a whole entity/world snapshot. It may also be nearly the whole world for dense or highly coupled rules.

There is no universal win. A baseline using the same abstract evidence, escrow rights, AOI, prediction and Canon kernel receives the same optimization freedom. Any future advantage must come from a better compiler/adapter or measured topology/control policy, not from renaming these ideas RRP.

## Executed B evidence

Run from repository root once the branch is checked out:

```sh
node apps/rinne/scripts/reality-thought-synthesis-proof.mjs \
  apps/rinne/docs/evidence/RRP_THOUGHT_SYNTHESIS_20260917.json
```

Observed in the isolated Node v22.16.0/Linux workspace used to author this change:

- 12/12 focused tests pass.
- 5/5 mutations are killed by invariant assertions:
  - existential knowledge instead of universal knowledge;
  - duplicate resource transfer;
  - pairwise consistency promoted to global consistency;
  - rely conditions ignored during composition;
  - unsound under-approximation trusted as complete knowledge.
- Finite models include 3 epistemic worlds, 16 decision-evidence worlds, 32 evolved-rule worlds, the 3-relation cyclic counterexample and 9 local quota-spend combinations.

These are deliberately small counterexample machines, not exhaustive distributed-system state-space proofs. Source SHA-256 hashes and the exact environment are stored in the evidence JSON.

No checkout existed for this session, so `context:plan`, `npm ci`, repository-wide fast validation, Node 24, browser/WebRTC/device checks and physical measurements were not executed. CI must not be inferred from this local evidence and is not polled by the implementation worker.

## Classification after this loop

### A / delegated A

- Under a declared possible-world model, if safe action requires `P`, acting only when every locally possible world satisfies `P` cannot violate `P` solely because the actor chose an unsafe compatible world.
- Preallocated nonnegative quotas whose sum is bounded by `T` preserve the aggregate bound while local consumption stays within each quota.
- Pairwise relational compatibility does not imply a global world in general; the retained triangle is a concrete witness. Stronger acyclic local-to-global results are delegated to their published relation model.
- KoP/common-knowledge, abstract interpretation, assume/guarantee, escrow/bounded-counter and failure-detector results remain known theory under their original premises.

### B

The 12 tests, five killed mutations, finite evidence minimization, epistemic acknowledgement graph, relation join, quota example, rate-distortion shape and causal-envelope examples.

### C

Completeness of the declared action predicate/effect grammar, sound conservative abstraction, evidence authenticity/truth semantics, genuine nonduplicable capability enforcement, durable generations, known dynamics for causal envelopes, and the selected failure/threat model.

### D

Which evidence to fetch first, AOI padding, abstraction granularity, prediction horizon, switch thresholds and how aggressively to preallocate rights.

### E

Measured byte reduction from decision evidence versus snapshots; extra round trips caused by refinement; p50/p95/p99 commit/refinement latency; rights-transfer frequency; dense-scene dependency size; WebRTC/TURN/backpressure; CPU/battery; error/distortion quality; BAR/Byzantine protection cost; comparison against equally optimized baselines.

### F

- Sound compiler from **all** Rinne gameplay rules to necessary action predicates, dependency edges and evidence extractors.
- Proof that every irreversible effect sink enforces the obligation/generation/capability.
- Dynamic rule/plugin/schema evolution without silently invalidating old evidence certificates.
- Composition across multiple protected actions/domains, membership changes and external transactions.
- Secure rights under rollback/storage loss/rational or Byzantine clients.
- Machine-checked refinement from the compiler + selected known protocols to runtime behavior.
- General minimal-evidence computation for unrestricted programs; the prior undecidability boundary still applies.
- Any general novelty claim for the integrated compiler.

## Stopping condition

This loop stops because the newly introduced theories have been classified into (1) known results delegated under their premises, (2) bounded executable counterexamples, (3) explicit assumptions, (4) heuristics, (5) measurements, or (6) concrete unresolved compiler/composition obligations. It does **not** stop because a checklist is true.

The most important remaining theoretical attack is now sharper: construct a restricted Rinne effect language for which the compiler can **soundly** derive action preconditions, conservative evidence abstractions, rights and composition domains, then prove that the generated obligations refine a known protocol stack. Until that exists, the architecture is a promising synthesis, not a finished new theory.

See [source register](THEORY_THOUGHT_SYNTHESIS_SOURCES.md).
