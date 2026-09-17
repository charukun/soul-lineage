# Independent RRP reconstruction and falsification

## Status and evidence language

Start source of truth: `develop` `97d6c5015f2241f97646c5aa1df386478c26d8ba` (2026-09-17).
PR #716 is still open/Draft at `df678cb59f42f0ec5502663febfe641e75f2549f`; this review treats its conclusions as hypotheses rather than inherited proofs.

This document deliberately does **not** use a finite checklist as a claim of theory completion. Every statement is tagged conceptually as one of:

- **A — conditional theorem / impossibility result**: deductive result under stated assumptions.
- **B — bounded-model evidence**: executable exploration or finite test evidence only.
- **C — assumption**: required premise, not established by this repository.
- **D — heuristic / architecture hypothesis**: useful design idea without a proof of optimality.
- **E — empirical**: requires measurement on real browsers/devices/networks/storage.
- **F — unknown**: not yet closed by theory or measurement.

## Executive result

The previous direction contained useful engineering ideas, but the strong claim that the remaining work was only physical validation does not survive independent review.

The central result is narrower and more defensible:

1. **Semantic separation is useful, but not a new general distributed-systems theorem.** RedBlue consistency, invariant confluence / coordination avoidance, CALM, CRDTs, causal consistency and HAT work already formalize large parts of the idea that only some operations need coordination.
2. **Canon Nucleus as a custom consensus protocol is not established.** The packet/state-space proof in #716 is a centralized executable specification with direct access to global liveness and remote durable state. That can serve as an oracle/specification, but not as evidence that a node-local protocol implements the same behavior.
3. **The strongest practical reconstruction is a semantic router over known protocols**, not a new monolithic consensus algorithm: reversible realtime work uses prediction/rollback/state-sync; monotone or invariant-confluent work uses local/causal/CRDT paths; irreversible shared facts use a proven replicated log/consensus service; external side effects keep their own idempotency/transaction boundary.
4. **Two potentially useful Rinne-specific residuals remain**, but neither is yet established as a novel theorem: (a) a causal observation horizon that suppresses updates that provably cannot affect an observer yet, and (b) an irreversible frontier that prevents speculative state from crossing a non-rollbackable game/external boundary without strong evidence.
5. **Quantum mechanics supplies constraints, not transport tricks.** No-signalling rules out using entanglement to bypass communication latency. “Measurement = Canon commit” has no quantum mathematical content and is discarded. The useful residue is classical information/causality reasoning.
6. **Philosophical ideas are useful only after translation into invariants.** Process/relational/phenomenological views motivate event projections, relation sufficiency and observer-relative views; those become ordinary distributed-systems conditions once formalized.

No universal dominance claim remains.

## What broke in the inherited theory

| Prior claim / mechanism | Independent attack | Classification after attack |
| --- | --- | --- |
| live durable quorum before visibility | #716 `canon-packet-proof.js` computes `live()` and `holders()` by directly reading all nodes' true state; ACK handling also inspects the remote sender store | **B only as centralized specification**, not a node-local protocol proof |
| recovery-complete crash recovery | `bestSurvivingProposal()` scans all surviving stores and recovery writes the chosen record into every survivor in one local loop | **C hidden oracle / atomic-copy assumption** in the proof model |
| bounded state-space closes packet ordering | explorer executes that centralized model and covers one operation / three nodes / one crash; retries and duplicates are outside that particular search scope | **B**, useful but much narrower than a protocol proof |
| invariant compiler certificate | duplicate resource IDs can overwrite in a `Map`; pair enumeration omits same-definition concurrent invocations; effect grammar accepts insufficiently checked shapes | **broken**, rebuilt with fail-closed grammar and self-pair checks |
| policy handoff generations compose globally | handoff instances can be constructed independently with caller-supplied `initialState` and generation; sequential proof manually threads one snapshot | **B pairwise only**; global transition lineage was unproved |
| uncertain completion solved by retry | retry/dedupe solves duplicate execution when the client retries with the same ID, but not the history where the client disappears forever | **A impossibility of client knowledge without later evidence**, server-side safety can still hold |
| election safety ∧ commit safety ∧ handoff safety ⇒ system safety | generation is a cross-component state variable; a commit rule that ignores the handoff generation can accept an old-generation write after a separately safe handoff | **false composition rule**; shared invariants are required |
| weighted comparison demonstrates architectural superiority | coefficient choices are designer-dependent and prior baselines did not always receive the same semantic split/topology freedom | **D only**; replace with symbolic/Pareto comparison and measurement |
| theory saturation checklist | `theory-saturation.js` defines a finite boolean list and declares saturation when all entries are true | **not a completeness argument**; an unlisted counterexample falsifies it immediately |

The repository therefore keeps #716 as useful prior exploration, not as the proof foundation of this reconstruction.

## Independent node-local model

Executable evidence lives in:

- `src/game/reality-lab/independent-reconstruction.js`
- `tests/reality-independent-reconstruction.test.mjs`
- `scripts/reality-independent-reconstruction-proof.mjs`

A protocol node in that model can read only:

- its persistent state;
- its volatile state;
- one delivered message at a time.

The **scheduler** may crash/pause/resume processes, reorder/drop/duplicate messages and inspect the whole experiment. The **independent oracle** may inspect all nodes after a trace. Neither scheduler nor oracle is a capability of a protocol node.

The model intentionally fails closed where it has not proved liveness. It is not proposed as a production replacement for Raft/Paxos/VR.

### Local persistent state

Each modeled node persists:

- authority epoch and one-vote-per-epoch record;
- active semantic generation;
- commit parent/head and commit records;
- stable invocation-ID dedupe evidence;
- prepared records;
- durable `fencedThrough` generation;
- transition predecessor/head and accepted transition records.

### Commit evidence

A leader proposes `(epoch, generation, parent, operationTypeId, invocationId, payload)`.
Followers persist a prepare before sending `PREPARED_ACK`. The leader creates a commit certificate only from a quorum of delivered ACK messages, persists its own commit, then sends the certificate. A client result is emitted only after a quorum of `COMMIT_ACK`s produced after local commit persistence.

This is **B bounded evidence**, not a proof of an unbounded consensus protocol. In particular, the model does not claim a complete leader-change/recovery algorithm with Raft/Paxos-level liveness.

### Recovery evidence

Recovery is message-driven: `RECOVERY_QUERY` → local `RECOVERY_REPLY` → candidate grouping of received evidence → `RECOVERY_INSTALL`. No protocol node directly reads another node's store, and installation occurs only when each destination receives a message.

The conservative base model requires a quorum of identical state evidence and may fail closed even when a more sophisticated consensus recovery protocol could safely progress. The production conclusion is therefore to **delegate the strong plane to a mature consensus/replication protocol** rather than turn this bounded research model into another bespoke consensus algorithm.

### Operation identity

`operationTypeId` and `invocationId` are separate. Dedupe is per invocation, so two legal concurrent uses of the same operation definition are distinct, while a retry of one invocation remains idempotent.

### Handoff fencing

A source generation records a durable fence **before** acknowledging `FENCE_PREPARE`. A target generation can be activated only by a quorum certificate of those fence acknowledgements. Transition records bind:

`(sourceGeneration, targetGeneration, predecessorTransitionRoot, stateRoot)`.

The predecessor and generation checks are shared with commit acceptance. This closes the specific stale-reactivation hole in the bounded model. Arbitrary membership changes and unbounded compositions remain outside this proof.

### Declared invariant compiler

The reconstructed compiler is deliberately smaller than #716's implied ambition. It supports only a finite declared grammar:

- bounded counter: integer `delta`;
- grow-only set: `add`;
- unique register: `assign`;
- single-use token: `consume=true`.

Unknown effects fail closed. Resource and operation IDs must be unique. Pair analysis includes `(operation, same operation)` to test concurrent invocations of the same definition. This is **not** a general I-confluence decision procedure.

## Bounded executable evidence

Focused local run on Node 22.16:

```text
node --test apps/rinne/tests/reality-independent-reconstruction.test.mjs
23 tests / 23 pass / 0 fail
```

Bounded explorer (`maxDepth=8`) currently visits **1,738 unique states and 4,937 transitions**, including arbitrary delivery/drop order and at most one process crash for a single invocation. It observes 404 result-bearing states and finds no base-model oracle violation.

Mutation/counterexample tests deliberately make the model unsafe and verify the independent checks fail or a forbidden transition becomes possible:

- quorum reduced by one → visible result with fewer than the declared quorum of durable copies;
- dedupe removed → one invocation ID obtains two committed roots;
- parent check removed → history fork;
- durable fence removed → old-generation quorum can acknowledge after handoff fencing;
- transition generation check removed → persisted fence can be bypassed and a chained transition can roll generation backward;
- transition predecessor check removed → a detached multi-handoff lineage can activate;
- recovery quorum removed → one reply can install a state that rolls committed history backward;
- unsupported effect grammar → rejected rather than silently classified;
- duplicate resource ID → rejected;
- same operation definition executed concurrently → analyzed as a self-pair.

This is **B**, not an unbounded proof. Passing these tests means the tests are sensitive to the listed mechanisms, not that all counterexamples have been enumerated.

## A–F ledger

### A — conditional theorems / impossibility results

1. **Quorum intersection.** Under one fixed membership set, any two strict majorities intersect. This is elementary set arithmetic; it does not by itself prove a consensus protocol.
2. **Client disappearance ambiguity.** If the only client observation is a timeout, the histories “operation committed, reply lost” and “operation not committed, no reply” are indistinguishable to that client without later communication or a trusted witness. Stable retry IDs can make retry safe, but cannot manufacture knowledge when the client never communicates again.
3. **Component safety is not compositional by conjunction.** Election, commit and handoff can each satisfy their local predicate while the combined system accepts a stale-generation commit unless generation/transition evidence is part of the shared commit invariant.
4. **Causal observation horizon, conditional form.** If a directed dependency graph is causally complete and every edge carries a sound nonnegative lower bound on influence delay, the shortest-path sum is a lower bound on when a source event can affect that observer. Before that bound the event need not be materialized for that observer. Omit a shortcut dependency and the result becomes unsafe.
5. **FLP boundary.** In a fully asynchronous message-passing model, deterministic consensus has an execution that does not terminate with even one crash fault. Any production liveness claim therefore needs assumptions beyond that model, such as partial synchrony/failure-detector behavior or randomized techniques.
6. **CAP/partition boundary.** Atomic consistency plus a guaranteed response to every request cannot both be guaranteed across arbitrary partitions in the usual asynchronous partition model.

### B — bounded model evidence

- node-local message model described above;
- 1,738-state / 4,937-transition bounded exploration;
- 23 focused tests including mutation sensitivity;
- one-vote-per-epoch same-epoch election example;
- pairwise durable generation fence and chained transition example.

### C — assumptions

- protocol-following crash faults unless an explicitly Byzantine plane is selected;
- persistent storage writes/ordering mean what the runtime adapter claims they mean;
- node identity/authentication is trustworthy enough for quorum membership;
- modeled certificate member IDs stand for authenticated evidence in a real implementation;
- the model's FNV-like `modelRoot` is **not cryptographic** and has no production security meaning;
- the causal graph used by an observation horizon is complete for the output being suppressed;
- minimum influence-delay bounds are sound;
- semantic effect declarations completely cover the invariant-relevant side effects of the operation;
- a fixed membership is used inside each bounded quorum argument unless reconfiguration is explicitly modeled.

### D — heuristics / architecture hypotheses

- identity as lineage/event ancestry rather than only mutable entity state;
- relation replication instead of full entity state when relation state is a sufficient statistic for all future relevant observations;
- using an observer-specific causal horizon to reduce update dissemination beyond geometric AOI;
- using an irreversible frontier to choose when speculative state must become strongly ordered/durable;
- selecting among direct peer, relay and SFU paths based on measured Pareto trade-offs.

### E — physical measurements required

- WebRTC/SCTP RTT, jitter, reordering, retransmission, buffering and head-of-line behavior under the game's channels;
- ICE/STUN/TURN path distribution and failure behavior;
- browser suspension/background/resume timing;
- IndexedDB/storage durability and loss behavior on target browsers/devices;
- Pixel-Fold-class CPU/frame/thermal/battery cost of prediction, relay and recovery;
- real packet-loss correlation and common failure domains (Wi-Fi, carrier, power, device/browser process);
- SFU cost/latency and direct-vs-relay crossover points;
- empirical prediction error envelopes used by the speculation boundary;
- AOI/causal-horizon false-negative rate under actual gameplay dependencies;
- bandwidth/latency coefficients. They are measurements, not theory constants.

### F — open

- unbounded machine-checked composition of election + commit + reconfiguration + semantic handoff;
- safe/lively dynamic membership under the exact desired peer/offline failure model;
- Byzantine/Sybil/cheating model for peer-hosted Canon, if peer authority is retained;
- authenticated certificate format and key lifecycle;
- storage corruption / correlated permanent storage loss model;
- starvation/fairness and liveness under an explicitly chosen synchrony model;
- automatic inference of arbitrary game invariants/effects;
- proof that causal-horizon suppression materially beats a strong conventional AOI implementation on Rinne workloads;
- proof that any remaining RRP-specific construction is novel relative to existing partial-replication, distributed-simulation and consistency literature.

## Fair comparison with known theory

The baseline rule is strict: every architecture below may use the same semantic split, batching, interest management and topology selection. “Raft” does **not** mean “replicate every realtime tick through Raft.” A fair baseline is Canon-only Raft plus a weak/realtime plane.

| Theory / family | What it already gives | Consequence for RRP reconstruction |
| --- | --- | --- |
| **Raft** | crash-fault replicated log, leader election and membership work with a well-defined safety story | strong Canon can be a small Raft log; semantic split is independent of Raft |
| **Paxos / Multi-Paxos** | classic crash-fault consensus/replicated-log foundation | no reason to re-prove majority consensus merely to keep realtime state off the log |
| **Flexible Paxos** | only cross-phase quorum intersection is fundamentally required in its model | custom “majority geometry” is not automatically optimal; alternative quorum trade-offs already exist |
| **Fast Paxos** | lower-latency fast rounds under stronger quorum/conflict conditions | relevant if Canon latency justifies complexity; not dominated by an RRP label |
| **EPaxos** | leaderless command replication with dependency/conflict ordering and fast common cases | directly challenges a blanket total-order Canon requirement when commands commute |
| **Viewstamped Replication** | primary/backup crash replication, view change, rejoin and reconfiguration | mature alternative for the strong plane |
| **Chain Replication** | fail-stop storage replication designed for strong consistency and throughput | useful strong-storage baseline; master/reconfiguration service remains a separate concern |
| **PBFT / HotStuff** | Byzantine replication under their respective assumptions; HotStuff targets partial synchrony/responsiveness and linear communication | if peers may lie, crash-only Canon is the wrong failure model; use BFT or trusted authority instead |
| **Dynamo** | high availability via partitioning, versioning, quorum-like techniques and conflict reconciliation with weaker consistency | useful weak/eventual baseline, not a substitute for unique irreversible facts |
| **CRDT** | datatype-level convergence under defined merge/update algebra | many mergeable game facts already fit known theory; “weak path” is not novel by itself |
| **RedBlue consistency** | separates operations that require strong order from operations that can execute more freely; generator/shadow transformation expands blue operations | close prior art for Semantic Frontier's core motivation |
| **I-confluence / coordination avoidance** | necessary-and-sufficient condition, within its formal model, for invariant-preserving coordination-free execution | the correct comparison target for an invariant compiler; our finite grammar is much weaker |
| **CALM** | monotonic programs characterize coordination-free consistent distributed computation in its logic setting | reinforces that “only coordinate non-monotone work” is established theory |
| **causal consistency / COPS** | causal dependencies can be tracked and made visible in dependency order at scale | causal frontier/observer dependencies need a more specific residual to be novel |
| **eventual consistency** | convergence eventually, without linearizable real-time order | valid for presentation/discovery state only when game invariants permit it |
| **HATs** | classifies which transaction/consistency guarantees can coexist with high availability under partitions | prevents vague claims that a semantic split evades CAP trade-offs |
| **deterministic lockstep** | transmit inputs and replay the same deterministic simulation | low bandwidth but waits for inputs and requires determinism; valid realtime baseline |
| **GGPO / rollback** | input prediction, speculative execution, save/load and re-simulation | directly matches reversible combat/movement when deterministic rollback is practical |
| **snapshot interpolation** | render delayed snapshots without a matching remote simulation | bandwidth/latency trade-off baseline for non-authoritative presentation |
| **state synchronization** | run simulation on both sides while sending selected state+input; does not require perfect determinism | strong practical baseline for physics/gameplay state |
| **server authoritative networking** | centralized trust/order for gameplay decisions | likely simplest anti-cheat/Canon boundary when infrastructure is acceptable |
| **peer-host networking** | avoids permanent game server for the realtime host but moves trust/failure/rehost complexity to peers | topology option, not a consistency theorem |
| **SFU / selective forwarding** | established point-to-multipoint forwarding topology | solves fan-out placement, not application consistency; must remain an equal Pareto option |
| **gossip / epidemic dissemination** | randomized eventual propagation/anti-entropy | useful presence/discovery dissemination; not a unique RRP relay insight |
| **multicast trees** | structured fan-out reduces sender degree at added path/failure complexity | another topology baseline for dense dissemination |
| **interest management / AOI** | filters updates in distributed virtual environments to improve scalability | observation frontier must beat/extend this baseline, not rename it |
| **HLA** | standardized distributed-simulation federation, services/interfaces and coordinated exchange | global Cartesian state is not required by distributed simulation practice |
| **optimistic simulation / Time Warp** | speculative event processing with rollback and antimessages | establishes that speculative distributed histories are old territory; game-specific irreversible boundaries are the interesting residue |

### Fair hybrid baselines

At minimum, future performance experiments must include:

1. **Canon-only Raft + authoritative realtime prediction/rollback + AOI/SFU**.
2. **CRDT/causal weak plane + Raft irreversible log + rollback realtime**.
3. **VR or Chain Replication strong plane + state synchronization realtime**.
4. **EPaxos-style conflict/dependency ordering for Canon commands + CRDT weak plane** where operational assumptions are acceptable.
5. **peer-host realtime + external durable Canon service**.
6. **custom peer Canon candidate**, but only after the same crash/BFT/storage assumptions are declared.

No weighted scalar score is allowed to declare a winner until the coefficients come from an explicit product objective or measurement. Keep a Pareto set when objectives conflict.

## Quantum mechanics: what survives and what is discarded

| Physical concept | Physics meaning relevant here | Classical distributed abstraction | Verdict |
| --- | --- | --- | --- |
| entanglement + **no-signalling** | nonlocal correlations do not provide controllable superluminal messaging | information that changes another device's output still requires a causal communication path | **A negative constraint**; no latency bypass |
| measurement | an operation in quantum theory with probabilistic/state-update semantics depending on formulation | “commit makes a fact irreversible to the application” | **discard as mathematics**; at most a metaphor |
| decoherence | loss of observable quantum coherence through environment interaction | none required for game networking | **discard as protocol mechanism** |
| Quantum Darwinism / environment as witness | selected information becomes redundantly recorded in environment fragments and independently accessible to observers | redundancy/dissemination can make a record widely observable | **analogy only**; classical replication/gossip already model the useful part |
| quantum uncertainty | constraints on quantum observables/state knowledge | prediction error envelope for rollback | **do not identify them**; game uncertainty budget is classical estimation |
| causal/no-signalling horizon | influences cannot be used as an arbitrary faster-than-light channel | suppress data until a sound dependency path can affect an observer | **classical formalization is useful**, quantum label is unnecessary |
| probability/information theory | quantitative uncertainty/information measures are real mathematical tools | entropy/coding/prediction models may inform compression or estimation | **potentially useful mathematics**, but no special quantum protocol follows |

The key rule is therefore simple: **nothing in this architecture assumes quantum computation, quantum communication, collapse, or entanglement.** The implementation target remains WebRTC/browser/mobile classical networking.

## Philosophy: only the formal residue survives

Philosophy is used here to challenge ontology, not to certify a protocol.

| Idea | Formalization attempt | Invariant / counterexample | Result |
| --- | --- | --- | --- |
| Heraclitus / process philosophy: entities are processes rather than static substances | mutable state is a projection/fold of an event lineage | replay/projection must reproduce every future invariant-relevant decision; hidden mutable state breaks equivalence | useful design lens; technically event sourcing/process state |
| Nāgārjuna / dependent origination and relational ontology | replicate relationships instead of intrinsic entity records | relation state is sufficient only if it is a sufficient statistic for all future observer-visible/irreversible outcomes; a hidden intrinsic variable that later changes damage is a counterexample | conditional optimization, not ontology theorem |
| Hume on causation | represent only declared causal dependencies | omitting a real dependency makes the observation horizon unsound | reduces to causal graphs/causal consistency/interest management |
| Kant / phenomenology: observer experience differs from thing-in-itself | server/world substrate may differ from each client's projected view | two clients need equal outputs only where game rules require shared facts; presentation may differ | established partial replication/client projection idea |
| structural realism | preserve invariant relations rather than byte-identical whole-world state | if all future rule outcomes depend only on those relations, full hidden representation equality is unnecessary | useful correctness criterion candidate |
| Leibniz / identity through continuity and relation | identity represented as genesis + ancestry of identity-transforming events | ancestry collision/fork must be rejected on irreversible identity changes | game-specific lineage model; adjacent to event sourcing/Merkle history |
| Parmenidean “single being” / Cartesian global-state intuition | demand one complete global state at every instant | distributed simulation, causal consistency and partial replication show this is unnecessary for many workloads | reject as a default architecture premise |

Nothing in this section is a safety proof by quotation from a philosopher. Once translated, each surviving claim is evaluated by ordinary mathematics and counterexamples.

## Reconstructed architecture for 輪廻転焦

No new grand name is assigned because the general ingredients are known. The recommended structure is descriptive and layered.

### 1. Observer projection plane

Maintain per-observer interest based on geometry **plus declared causal dependencies**. Do not send an event merely because it exists globally; send it when it can affect that observer's permitted outputs or when prefetch margin requires it.

A causal observation horizon may defer materialization only when the dependency graph is complete and edge delay lower bounds are sound. Otherwise fall back to conventional AOI/interest management.

### 2. Reversible realtime plane

Movement, animation, transient combat presentation and other rollbackable state use the fastest topology compatible with the active trust model:

- authoritative client/server prediction;
- peer-host + prediction;
- GGPO-like rollback when deterministic save/load is viable;
- state synchronization or snapshot interpolation where determinism is not viable.

Realtime nodes may disagree temporarily. The contract is bounded correction, not global-tick identity.

### 3. Confluent / causal plane

Monotone discoveries, grow-only facts and genuinely mergeable social/presence data use CRDT/causal/eventual mechanisms only when declared semantics prove the weak path safe. Unknown effects escalate rather than being guessed mergeable.

### 4. Irreversible Canon plane

Deaths/rebirth lineage, unique ownership/consumption, irreversible rewards and other shared nonrollbackable facts enter a small strong plane.

**Recommendation:** start with a mature crash-fault replicated log/service such as Raft/VR/Paxos-family infrastructure rather than custom peer consensus. If malicious clients can participate as replicas, either keep authority in trusted infrastructure or adopt an explicitly Byzantine design; crash-only quorum proofs are insufficient.

Consensus decides the irreversible event/order/evidence needed by the application. It does **not** replicate every realtime tick.

### 5. External effect plane

Payments, platform inventory, external persistence or any non-rollbackable third-party side effect keep an external idempotency/transaction/outbox contract. A local Canon event is not proof that a remote external system performed the side effect.

### 6. Reconfiguration plane

Membership and semantic-policy transitions are themselves strong state. A generation change must be chained to its predecessor and fenced through the same strong authority mechanism. Do not run an unrelated local handoff protocol beside a consensus membership protocol and assume the two compose.

## “World state” after reconstruction

The architecture no longer assumes a single materialized Cartesian state shared by all players at one tick.

A more precise model is:

- **durable fact history**: the small set of irreversible facts that need globally agreed ancestry/order;
- **causal/mergeable facts**: partially ordered or convergent information;
- **observer projection**: the state a client currently needs to render/decide;
- **speculative local trajectory**: reversible predicted state;
- **external facts**: facts whose authority belongs to another service.

A player's view and durable world truth are therefore intentionally different types. They coincide only at invariants that require it.

## Identity and replication

Entity ID remains useful as an address, but irreversible identity can be represented by **lineage**:

`identity = genesis + ordered identity-transforming ancestry`.

Mutable presentation state is then a projection over lineage plus current local/causal facts. This can improve dedupe/recovery semantics in a reincarnation game, but it is not a newly discovered distributed identity theorem.

Relationship-only replication is allowed only under a **sufficient-statistic condition**: if two hidden world states have the same replicated relation state, then every future permitted input sequence over the declared horizon must produce the same observer-visible and irreversible outcomes. One counterexample invalidates the compression.

## Uncertainty / speculation budget

The only retained “uncertainty budget” is classical:

- let `epsilon(t)` be a defensible upper bound on prediction error relevant to a rule;
- let `margin(t)` be distance to the nearest discrete/irreversible decision boundary;
- local speculation is admissible only while the output is rollbackable and `epsilon(t) < margin(t)`;
- reconcile before the inequality can fail or before crossing an external/irreversible boundary.

The error envelope is **E empirical** for real gameplay. This is not the Heisenberg uncertainty principle.

## Lower bounds and impossibility boundaries

The reconstruction explicitly does not claim to defeat:

- FLP liveness limits in full asynchrony with crash faults;
- CAP-style consistency/availability trade-offs under partition;
- quorum-intersection requirements of the chosen strong protocol;
- the need for communication when one machine's new information must causally change another machine's output;
- information-theoretic bandwidth needed to distinguish genuinely different observer outputs;
- Byzantine replica bounds when arbitrary/malicious faults are in scope;
- client knowledge limits after uncertain completion and permanent disappearance.

There is also no theory-only lower bound proving the proposed Rinne mix uses less bandwidth/latency than every fair hybrid. That requires workload distribution and measured cost parameters.

## Stop condition for this loop

The loop stops here **only because every currently identified question is assigned to one of four explicit destinations**, not because a checklist passed:

1. **closed by conditional reasoning**: quorum intersection, client-timeout ambiguity, composition counterexample, conditional causal-horizon theorem;
2. **delegated to known theory**: strong consensus/replication, CRDT/causal consistency, rollback/state-sync, interest management, distributed simulation;
3. **left as bounded executable evidence**: this repository's node-local model and mutation tests;
4. **requires external evidence or remains open**: physical performance/durability, Byzantine threat, dynamic membership, unbounded composition/optimality/novelty.

This stopping condition is itself falsifiable: a new counterexample or an unclassified obligation reopens the theory loop immediately.

## Primary / canonical sources used for the comparison

- Fischer, Lynch, Paterson, **Impossibility of Distributed Consensus with One Faulty Process**: <https://www.cs.cornell.edu/courses/cs614/2004sp/papers/FLP85.pdf>
- Gilbert and Lynch, **Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services**: <https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer2.pdf>
- Ongaro and Ousterhout, **Raft** publication index: <https://raft.github.io/>
- Lamport, **Paxos Made Simple**: <https://www.microsoft.com/en-us/research/publication/paxos-made-simple/>
- Lamport, **Fast Paxos**: <https://www.microsoft.com/en-us/research/publication/fast-paxos/>
- Howard, Malkhi, Spiegelman, **Flexible Paxos**: <https://arxiv.org/abs/1608.06696>
- Moraru, Andersen, Kaminsky, **EPaxos**: <https://www.cs.cmu.edu/~dga/papers/epaxos-sosp2013-abstract.html>
- Liskov and Cowling, **Viewstamped Replication Revisited**: <https://dspace.mit.edu/entities/publication/80846d94-fcd3-40e6-87fb-8d91fe99a5d1>
- van Renesse and Schneider, **Chain Replication**: <https://www.usenix.org/conference/osdi-04/chain-replication-supporting-high-throughput-and-availability>
- Castro and Liskov, **PBFT**: <https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance>
- Yin et al., **HotStuff**: <https://arxiv.org/abs/1803.05069>
- DeCandia et al., **Dynamo**: <https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store>
- Li et al., **RedBlue Consistency**: <https://www.usenix.org/conference/osdi12/technical-sessions/presentation/li>
- Bailis et al., **Coordination Avoidance / I-confluence**: <https://amplab.cs.berkeley.edu/publication/coordination-avoidance-in-database-systems/>
- Hellerstein and Alvaro, **Keeping CALM**: <https://arxiv.org/abs/1901.01930>
- Shapiro et al., **CRDTs**: <https://inria.hal.science/inria-00609399>
- Lloyd et al., **COPS causal consistency**: <https://www.cs.cmu.edu/~dga/papers/cops-sosp2011-abstract.html>
- Bailis et al., **Highly Available Transactions**: <https://dsf.berkeley.edu/papers/vldb14-hats.pdf>
- GGPO official overview and developer guide: <https://www.ggpo.net/> and <https://github.com/pond3r/ggpo/blob/master/doc/DeveloperGuide.md>
- Fiedler, **Snapshot Interpolation / State Synchronization**: <https://gafferongames.com/post/snapshot_interpolation/> and <https://www.gafferongames.com/post/state_synchronization/>
- Jefferson, **Virtual Time / Time Warp**, DOI `10.1145/3916.3988`.
- IEEE 1516-2025, **High Level Architecture (HLA)**: <https://standards.ieee.org/ieee/1516/6687/>
- Demers et al., **Epidemic Algorithms for Replicated Database Maintenance**, DOI `10.1145/41840.41841`.
- Liu and Theodoropoulos, **Interest management for distributed virtual environments: A survey**: <https://research.ibm.com/publications/interest-management-for-distributed-virtual-environments-a-survey>
- RFC 7667, **RTP Topologies / Selective Forwarding Middlebox**: <https://www.rfc-editor.org/rfc/rfc7667.html>
- Bruss et al., **Approximate quantum cloning and the impossibility of superluminal information transfer**: <https://journals.aps.org/pra/abstract/10.1103/PhysRevA.62.062302>
- Ollivier, Poulin, Zurek, **Environment as a witness**: <https://journals.aps.org/pra/abstract/10.1103/PhysRevA.72.042113>
- Riedel and Zurek, **Quantum Darwinism in an Everyday Environment**: <https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.105.020404>

## Current novelty claim

No new general consensus theorem is claimed.

The only **novelty candidates** worth further literature review and experiment are the Rinne-specific composition of:

1. observer projection driven by a causally complete game dependency graph rather than geometry alone;
2. a measured speculation margin tied explicitly to irreversible gameplay boundaries;
3. lineage identity as the durable core of a reincarnation game while most mutable presentation state remains partial/speculative;
4. an invariant/effect declaration that routes operations to known consistency mechanisms and fails closed on unsupported semantics.

Each of these could still reduce to known partial replication, robust prediction, event sourcing or invariant-routing work. Until that residual search is done, call them **F novelty candidates**, not discoveries.
