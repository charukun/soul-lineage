# Observation, causality and identity without quantum mysticism

Companion to [the independent reconstruction](THEORY_RECONSTRUCTION.md). A means a conditional mathematical argument, B finite executed evidence, C a premise, D a heuristic, E a measurement and F an open obligation. This note introduces no new protocol name. The proposed abstractions must survive classical implementation and prior-art comparison before any novelty claim.

## Quantum physics: retain a constraint, not a speedup

In quantum theory a density operator rho represents a quantum state, and a measurement instrument determines outcome probabilities and conditional post-measurement states. That is not the same object as a JSON game snapshot, a player's incomplete information or an authoritative database write. Entanglement is not merely two classical clients sharing a seed. IBM's quantum-information treatment explicitly distinguishes classical correlations and entangled states [Q1].

For a local trace-preserving quantum channel E_A with Kraus operators K_i, sum_i K_i†K_i = I. On a joint state rho_AB:

```text
rho'_B = Tr_A[ sum_i (K_i tensor I) rho_AB (K_i† tensor I) ]
       = Tr_A[ rho_AB (sum_i K_i†K_i tensor I) ]
       = Tr_A[rho_AB] = rho_B.
```

The cyclic move is only for operators on the subsystem being traced out. This proves **A**, under the stated channel model, that an unconditioned local operation cannot change B's local outcome statistics. Selecting a particular measurement outcome changes a *conditional* state; B needs the classical outcome information to exploit that conditioning. Quantum teleportation explicitly uses two classical bits as well as shared entanglement [Q2]. There is no instantaneous network message here.

**Classical extraction:** formalize absent causal influence, not "quantum synchronization." If actions in region A cannot affect B's allowed observations or protected decisions over a declared horizon, B need not receive their detailed state over that horizon. This is ordinary dependency/noninterference reasoning. The dependency premise must be established from game rules and pending messages; quantum mechanics does not establish it for the game.

| Physical concept | Possible game abstraction | Classification and limit |
|---|---|---|
| State and observation | Hidden implementation state and observer projection | Mathematical projection is usable; it is not a quantum density operator or collapse. |
| No-signalling / locality | No permitted causal path to an observer or decision | Useful constraint analogy; the classical proof comes from transition/dependency rules. |
| Entanglement | Correlated information across actors | A shared seed is classical correlation, not entanglement. No borrowed quantum advantage. |
| Measurement | An irreversible receipt or protected decision boundary | A classical protocol event. Calling Canon commit a measurement adds no mathematical result. |
| Uncertainty | Bounded prediction error or calibrated probability of rollback | Classical estimation, not a Heisenberg uncertainty relation. |
| Decoherence | Sometimes likened to settling competing predictions | Discard this analogy as an algorithmic justification; decoherence is not quorum recovery or conflict resolution. |
| No-cloning | Sometimes used to justify unique game entities | Inapplicable: classical bits are copyable. Entity uniqueness requires identifiers, authentication and invariant enforcement. |

No quantum computation, quantum channel, entangled hardware or quantum random source is assumed. Quantum mechanics produced **zero claimed communication speedup** in the implementation. The usable result is a disciplined separation of local information, causal influence and conditional knowledge.

## A formal reduction of the world state

Let D be an invariant domain of game states, A an allowed input/action set, and T: D×A→D a deterministic transition. Let O_o(s) be observer o's permitted output. Protected decision predicates (ownership, life uniqueness, final reward) are outputs too, even when not currently rendered. Let pi: D→Q be a proposed reduced representation.

Assume **C**:

```text
(1) O_o(s) = Obar_o(pi(s)) for all permitted observers/decisions;
(2) pi(T(s,a)) = Tbar(pi(s),a) for every s in D and allowed a;
(3) T(s,a) remains in D; input enablement is preserved or encoded;
(4) shared randomness, when present, is included as explicit input/state.
```

**A (conditional induction):** equal initial pi values give equal abstract values after an empty trace. If they are equal after a trace, (2) preserves equality after the next common allowed action, while (3) keeps the premise applicable. By induction, (1) gives identical permitted outputs after every finite allowed action trace. Thus full state copies can be replaced by pi for those observations and actions. Adaptive observer actions also remain aligned when their decisions depend only on the preserved outputs.

This is a familiar behavioral quotient/congruence argument, closely related to simulation/bisimulation and sufficient state, not a discovered physical law. The executable `checkFiniteQuotient` checks a finite domain including closure, and is **B** for that domain. A quotient of an unbounded game requires its own proof. Equality of merely the current screenshot is not the premise.

**Attack 1: hidden projectile.** Two states have the same visible actor positions but a different projectile outside the viewport. A later step reveals damage in only one. The current rendering projection passes an immediate-view check and fails transition compatibility. The test retains this witness.

**Attack 2: delayed observation.** "No one has looked in this chest" does not imply its content is irrelevant: it may reserve the last unique item or change a quest total elsewhere. A counterfactual future query can distinguish it. Keep the constraint/seed/reservation needed for future coherence, not necessarily the rendered object.

**Attack 3: escaping the tested domain.** A finite checker can see no difference on its listed states yet leave that set after one action. The next unlisted transition can reveal the hidden field. The checker now rejects unclosed domains rather than calling such a check a proof.

## Observation frontier as an obligation, not a visibility list

Define a rule-derived graph x→y when a change to x can influence a permitted observation or protected decision involving y. For an observer's targets V and pending irreversible decisions J, include their reverse dependency closure, plus relevant in-flight messages and obligations. A spatial AOI is only one source of edges.

Classical causal ordering already supplies a partial-order view of events [L3]. COPS checks dependencies before exposing causally dependent data [W4]. HLA Data Distribution Management provides region/subscription matching [S1]. These are prior art, not primitive versions of RRP to defeat.

**Counterexamples:** global auction stock, lineage constraints across distant villages, remote trade, long-range projectiles and teleportation connect distant regions. A model that prunes solely on geographic distance can miss them. Historical correlation is also not a proof of a missing dependency. Unknown effect grammar or an unknown graph edge must widen the scope or coordinate; it cannot certify noninterference.

A causal cone may be bounded using maximum speed, acceleration, influence radius and a chosen lookahead horizon only when the rules really impose those bounds. Local wall-clock silence says nothing about an arbitrarily delayed packet. Paused clocks, teleports and external services need separate edges/obligations. Local simulation islands need not share a global tick, but effects crossing islands must respect their common causal/commit contract.

The replica need not know the omniscient dependency closure. A compiler may derive a conservative graph from declared rules and send versioned subscriptions/capabilities; each node then acts only on received messages and local metadata. Proving that compiled graph contains **all** runtime effects is **F**. The current finite graph helper checks closure, not arbitrary-code dependency extraction.

## Lazy materialization: what may remain unconstructed

A region can be represented by a versioned deterministic generator plus constraints and a committed seed, rather than every generated entity. Materialize only on demand, provided future permitted queries and protected facts are invariant under the missing detail. The sufficient statistics may be larger than a seed: ownership, depletion, visited facts, player changes and pending transfers must survive.

A common seed reduces transmission only for information already implied by that seed and shared rules. It cannot recreate unknown player choices or external outcomes without information arriving. A secret seed known to an adversarial host does not ensure fair random loot; repeated generation/restart can bias outcomes. Commitments or an external randomness/authority contract would be a separate system, not quantum observation. This reference has not implemented a production lazy-world generator.

The real question is not "does an unobserved object exist?" It is: "which distinctions can any allowed future interaction expose, and what constraints preserve those distinctions?" The result may be a relationship graph or event log rather than an entity snapshot. In a dense fully connected interaction graph, relations can cost O(n²); changing the word from state to relation guarantees no compression.

## Identity, truth, records and philosophical prompts

The following are **our engineering formalizations prompted by philosophical questions**, not claims that philosophers proved networking theorems. Metaphysical truth is not used as a trusted service.

| Prompt / tradition | Formalization | Invariant and cost consequence | Refutation or boundary |
|---|---|---|---|
| Leibniz: indiscernibility [P1] | Identity of representations relative to all permitted future traces | Quotient conditions above can remove irrelevant fields | Current appearance is not future equivalence; query language matters. |
| Heraclitus / process thought | Track an entity by a birth event and subsequent life transitions, not a frozen snapshot | Stable `(realm, birth-operation, incarnation)` plus checked parent relations can survive body/appearance changes | Forked parent claims require conflict resolution; a hash alone proves neither authenticity nor uniqueness. |
| Dependent origination / relational questions [P2] | Store relations and constraints sufficient for allowed behavior | Ownership, descent and scarce-right constraints define coordination domains | A dense relation graph or global scarcity recreates broad coordination. This is not an assertion that Buddhist metaphysics is a distributed protocol. |
| Hume: causation versus observed regularity [P3] | Do not infer absent causal effects merely from sampled histories | Require declared effects, conservative reachability and counterexample tests | A never-observed teleport still breaks an AOI proof when the rules permit it. |
| Perspectival/phenomenological questions | Distinguish provisional observer views from mutually binding decisions | Different interpolation/prediction states may coexist; overlapping irreversible facts must agree | Two players each owning the same exclusive item cannot be excused as different realities. |
| Record versus past reality | A log is certified evidence of protocol decisions, not automatically of their factual justification | Validate causal read versions, rules and authority before irrevocable commitment | Consensus about a false combat claim remains false game history. |

A single physically complete world state is not required as a runtime representation. The meta-model may still use a mathematical product of node states for analysis without granting that product as a capability to any node. Similarly, a single log is not necessary across independent conflict domains, but independent logs do not make a shared invariant independent. Common facts require a merge rule, escrow or coordination that actually preserves the relation.

Canon irrevocability is a contract: later protocol states cannot retract an accepted fact within the failure/trust model. A later compensating event can be a new fact, not a secret rewrite. It is not thermodynamic irreversibility, observation collapse or a guarantee against every physical destruction of storage.

## Uncertainty and information budgets

For constant-velocity prediction with initial position error e0, initial velocity error ev, elapsed time t and a true bound amax on acceleration, integration and the triangle inequality yield the conservative error bound:

```text
e(t) <= e0 + ev*t + (amax*t*t)/2.
```

This is **A under C bounds**, not a general game formula when collisions, input discontinuities or teleportation invalidate those bounds. An engineering policy can stop extrapolation, enlarge interest scope or delay an irreversible effect when the bound crosses epsilon. Calibrating `P(error > epsilon) <= delta` from traces is **D/E** and cannot be silently promoted to a hard safety guarantee. With unbounded communication delay there is no fixed universal rollback/staleness ceiling.

**O1 information boundary:** for a discrete fact C unknown to a receiver with side information Z, lossless coding has an expected information requirement related to H(C|Z), given the usual coding assumptions. Shared rules/seeds alter Z; they do not transmit genuinely new facts for free. This is classical Shannon information theory, not a quantum workaround. Full copies, erasure fragments, event replay and procedural generation are different encodings with different recovery costs. The three-fragment XOR test refutes only the universal *full-copy storage* lower-bound claim, not information conservation or consensus intersection.

## Why a complete automatic classifier is not promised

Consider an unrestricted program P simulated one step per allowed game action. Maintain a hidden bit b, and display b only after P halts. Two initial states differing only in b are observationally indistinguishable for every finite trace exactly when P never halts. A terminating sound-and-complete algorithm deciding this future equivalence for arbitrary programs would decide the halting problem (by complementing its answer). **A:** no such general decider exists [O2].

This does not prohibit useful proofs or scientific progress. It directs implementation toward restricted effect languages, explicit invariants, proof objects, conservative abstraction and deliberate unknown results. A finite checklist can be complete for a genuinely finite closed model; it cannot prove that every future game feature is included. The actual new liveness bug found after enlarging this review's trace is a concrete warning against that leap.

No concept in this note earns a new name. The residual research question is whether a game-specific compiler can produce and validate these conservative dependency, observation and capability obligations with acceptable runtime and developer cost. Its correctness for Rinne and advantage against equally optimized prior-art hybrids are **F/E**, respectively.

## Sources

Technical references L3, W4 and S1 are in the [primary-source register](THEORY_RECONSTRUCTION_SOURCES.md). Philosophy references are scholarly expositions used only for the prompts, not for technical proof authority.

- Q1 — IBM Quantum Learning, John Watrous, *Entanglement in action: introduction*: https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/entanglement-in-action/introduction
- Q2 — IBM Quantum Learning, *Quantum teleportation*: https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/entanglement-in-action/quantum-teleportation
- O1 — Shannon, *A Mathematical Theory of Communication* (1948), original paper: https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf
- O2 — Turing, *On Computable Numbers, with an Application to the Entscheidungsproblem* (1936): https://www.cs.virginia.edu/~robins/Turing_Paper_1936.pdf
- P1 — Stanford Encyclopedia of Philosophy, *Gottfried Wilhelm Leibniz*: https://plato.stanford.edu/entries/leibniz/
- P2 — Stanford Encyclopedia of Philosophy, *Nagarjuna*: https://plato.stanford.edu/entries/nagarjuna/
- P3 — Stanford Encyclopedia of Philosophy, *David Hume*: https://plato.stanford.edu/entries/hume/
