# Independent RRP reconstruction and falsification

## Status

Source of truth at task start: `develop` `97d6c5015f2241f97646c5aa1df386478c26d8ba` (2026-09-17).
PR #716 remains historical input only while it is open/Draft at `df678cb59f42f0ec5502663febfe641e75f2549f`; this review does not inherit its proof claims.

The result is intentionally narrower than the earlier RRP claims. It does not declare a new consensus theorem, universal dominance, or “theory complete” state.

Evidence classes used throughout:

- **A — theorem / impossibility result**: deductive result under explicit assumptions.
- **B — bounded executable evidence**: finite model/test exploration only.
- **C — assumption**: required premise, not proved here.
- **D — heuristic / architecture hypothesis**: plausible engineering rule without optimality proof.
- **E — empirical**: requires measurements on real devices, browsers, networks or storage.
- **F — unknown/open**: not closed by the current theory or evidence.

A finite checklist is never treated as proof of completeness.

## Executive result

The prior work contained useful engineering ideas, but the claim that only physical validation remained does not survive independent review.

1. **Semantic separation survives as architecture, not as a new general theorem.** RedBlue consistency, invariant confluence / coordination avoidance, CALM, CRDTs, causal consistency and HAT work already cover much of the principle “coordinate only the operations whose semantics require it.”
2. **Canon Nucleus is not established as a new consensus protocol.** The #716 packet model directly reads global node liveness and remote durable state and performs recovery through globally visible stores. It is useful as a centralized specification/oracle, not proof that a node-local protocol implements the same behavior.
3. **The strongest practical architecture is a semantic router over established mechanisms.** Reversible realtime state uses prediction/rollback/state synchronization; monotone or invariant-confluent facts use causal/CRDT paths; irreversible shared facts use a proven replicated log/consensus service; external side effects keep their own idempotency/transaction boundary.
4. **The Rinne-specific residuals are narrower:** observer-specific causal suppression, an irreversible speculation frontier, lineage-oriented identity, and fail-closed routing from declared game invariants. These are novelty candidates only, not discoveries.
5. **Quantum mechanics yields constraints, not transport tricks.** No-signalling rules out entanglement as a latency bypass. “measurement = Canon commit” is discarded as mathematics. The useful residue is classical causal/information reasoning.
6. **Philosophical ideas survive only after translation to invariants.** Process, relational and observer-relative views motivate event lineage, sufficient-statistic replication and projections, but correctness is decided by ordinary distributed-systems reasoning.

No universal winner is claimed.

## What broke in the inherited theory

| Prior claim / mechanism | Counterexample / audit result | Classification now |
| --- | --- | --- |
| live durable quorum before visibility | #716 `canon-packet-proof.js` computes global `live()`/`holders()` and ACK processing reads the sender's actual durable store | **B centralized specification**, not a node-local protocol proof |
| recovery-complete crash recovery | recovery scans all surviving stores and installs the chosen value into survivors through one global model operation | hidden **C oracle / atomic-copy assumption** |
| bounded packet state-space closes the protocol | explorer runs that centralized model; one bounded search is one operation / three nodes / one crash | **B only** |
| invariant certificate proves supported semantics | duplicate resource IDs were not rejected, same-definition concurrent invocations were omitted from pair analysis, and effect grammar was insufficiently strict | **broken**, rebuilt fail-closed |
| pairwise handoff fencing composes globally | independent handoff instances can be created with caller-supplied state/generation; the sequential example manually threads one snapshot | pairwise **B**, global transition lineage unproved |
| retry solves uncertain completion | stable retry can make re-execution idempotent, but a client that disappears permanently cannot distinguish “committed/reply lost” from “not committed” without later evidence | **A knowledge boundary** |
| safe election AND safe commit AND safe handoff implies safe system | stale generation can cross component boundaries unless generation/transition evidence is part of the shared commit invariant | conjunction is **false** as a composition rule |
| weighted cost score proves superiority | coefficients are designer-selected and unfair baselines can be deprived of the same semantic split/topology freedom | **D**, use Pareto comparison + measured inputs |
| `theory-saturation` boolean list proves completion | an unlisted counterexample invalidates completeness immediately | not a completeness argument |

## Independent node-local model

Executable evidence:

- `src/game/reality-lab/independent-reconstruction.js`
- `src/game/reality-lab/independent-boundaries.js`
- `tests/reality-independent-reconstruction.test.mjs`
- `tests/reality-independent-boundaries.test.mjs`
- `scripts/reality-independent-reconstruction-proof.mjs`
- `scripts/reality-independent-architecture-proof.mjs`

A modeled protocol node may read only:

- its own persistent state;
- its own volatile state;
- the currently delivered message.

The adversarial scheduler may crash/pause/resume processes and deliver/drop/reorder/duplicate messages. The independent test oracle may inspect the experiment after a trace. Neither scheduler nor oracle is a node capability.

### Persistent state

Each node persists:

- authority epoch and one-vote-per-epoch record;
- active semantic generation;
- commit parent/head and commit records;
- stable invocation-ID dedupe evidence;
- prepared records;
- durable `fencedThrough` generation;
- transition predecessor/head and accepted transition records.

### Commit evidence

A proposal binds:

`(epoch, generation, parent, operationTypeId, invocationId, payload)`.

A follower persists a prepare before `PREPARED_ACK`. The leader derives a commit certificate from delivered quorum ACKs, persists its own commit, and sends the certificate. A client result is emitted only after a quorum of `COMMIT_ACK`s generated after local commit persistence.

This is **B bounded evidence**. It is deliberately not promoted into a new production consensus implementation.

### Recovery

Recovery is message-driven:

`RECOVERY_QUERY -> RECOVERY_REPLY -> RECOVERY_INSTALL -> RECOVERY_ACK`.

No node directly reads another node's store, no global alive set is a protocol input, and no atomic copy is available. The conservative model requires quorum evidence and may fail closed even where a mature protocol could progress. Production strong-state recovery should therefore be delegated to the chosen consensus/replication system.

### Operation identity

`operationTypeId` and `invocationId` are distinct. Two concurrent legal invocations of one operation definition remain distinct; retry of the same invocation is idempotent.

### Policy / semantic generation handoff

A source generation persists its fence **before** acknowledging `FENCE_PREPARE`. Target activation requires quorum fence evidence. A transition binds:

`(sourceGeneration, targetGeneration, predecessorTransitionRoot, stateRoot)`.

Commit acceptance and transition activation share generation checks. The transition predecessor closes the specific multi-handoff detach/reactivation hole in the bounded model.

### Failure domains

Replica count and independent failure domains are separate quantities. Two durable copies behind one correlated failure domain can both disappear under one domain failure; two copies therefore do not imply one-domain fault tolerance.

The exact real-world failure-domain map is **E empirical/C declared**, not inferable from process IDs.

### Membership rotation

Directly replacing `{a,b,c}` with `{c,d,e}` permits an old quorum `{a,b}` and a new quorum `{d,e}` with zero intersection. A direct switch can therefore certify conflicting successors without a joint transition.

The reconstruction does not invent another reconfiguration protocol. Membership change is delegated to the selected consensus protocol's proven reconfiguration mechanism, or requires an equivalent proof.

### Declared invariant compiler

The reconstructed compiler is intentionally finite and fail-closed:

- bounded counter: integer `delta`;
- grow-only set: `add`;
- unique register: `assign`;
- single-use token: `consume=true`.

Unknown effects are rejected. Resource IDs and operation definition IDs must be unique. Pair analysis includes `(operation, same operation)` so simultaneous invocations of the same definition are tested. This is **not** a general I-confluence decision procedure.

## Executable evidence

Focused validation on Node 22.16:

```text
node --test \
  apps/rinne/tests/reality-independent-reconstruction.test.mjs \
  apps/rinne/tests/reality-independent-boundaries.test.mjs
# 27 tests / 27 pass / 0 fail

node apps/rinne/scripts/reality-independent-reconstruction-proof.mjs
# pass=true
# bounded state-space: 1,738 states / 4,937 transitions / 404 result-bearing states

node apps/rinne/scripts/reality-independent-architecture-proof.mjs
# pass=true
# retained correlated-failure and direct-membership-switch counterexamples
```

Bounded exploration scope: three crash-fault nodes, one invocation, arbitrary delivery/drop/reorder at explored depths, at most one process crash, `maxDepth=8`, no unbounded liveness claim.

The focused suite covers or explicitly attacks:

- process crash/restart;
- pause/resume;
- delayed, lost, duplicated and reordered messages;
- old epoch and old generation messages;
- stable retry and permanent client disappearance as separate cases;
- storage loss as distinct from process restart;
- concurrent same-epoch election voting;
- policy switch and chained generation handoff;
- correlated failure-domain placement;
- direct membership rotation counterexample;
- same-operation concurrent invocation;
- unsupported effect grammar and duplicate resource IDs.

Mutation sensitivity intentionally breaks one mechanism at a time:

- quorum reduced by one -> client-visible result below declared durable quorum;
- fence removed -> old-generation acknowledgements remain possible;
- dedupe removed -> one invocation obtains multiple committed roots;
- parent check removed -> history fork;
- recovery quorum removed -> one reply can roll installed history backward;
- generation check removed -> stale generation can bypass a persisted fence / generation can roll backward;
- transition predecessor removed -> detached multi-handoff lineage activates.

Passing the finite suite means the checks are sensitive to these mutations. It does **not** mean every execution has been explored.

## A-F ledger

### A — conditional theorems / impossibility results

1. **Majority intersection.** Under one fixed membership, two strict majorities intersect. This does not by itself prove a consensus protocol.
2. **Client disappearance ambiguity.** With only a timeout observation, “committed and reply lost” and “not committed” are indistinguishable to the disappeared client until later communication or a trusted witness.
3. **Component safety does not compose by conjunction.** Election, commit and handoff can each satisfy a local predicate while a stale-generation commit crosses their boundary unless generation/transition evidence is shared by the commit invariant.
4. **Direct membership switch counterexample.** Old/new configurations can have valid disjoint quorums; reconfiguration therefore requires a joint/equivalent safety mechanism.
5. **Failure-domain boundary.** Replica count alone says nothing about correlated-domain tolerance without placement assumptions.
6. **Causal observation horizon, conditional form.** If the dependency graph is causally complete and every edge has a sound nonnegative minimum influence delay, the shortest-path delay is a lower bound on when the source can affect that observer. A hidden shortcut invalidates it.
7. **FLP boundary.** Fully asynchronous deterministic consensus has a nonterminating execution with one crash fault.
8. **CAP partition boundary.** Atomic consistency and guaranteed response cannot both be guaranteed across arbitrary partitions in the usual model.

### B — bounded model evidence

- node-local message transition model;
- 1,738 states / 4,937 transitions / 404 result-bearing states at the declared bound;
- 27 focused proof/mutation tests;
- persistent one-vote-per-epoch same-epoch election example;
- durable generation fence and multi-handoff predecessor chain;
- combined commit -> policy fence -> restart -> delayed old message -> stable retry scenario.

### C — assumptions

- protocol-following crash faults unless a Byzantine plane is explicitly selected;
- local durable storage means what its adapter claims and preserves ordering/durability as specified;
- node identities and quorum evidence are authenticated in production;
- test `modelRoot` is deterministic only and **not** a cryptographic certificate;
- causal dependency graphs used for suppression are complete for the affected output;
- minimum influence delays are sound lower bounds;
- declared effects include every invariant-relevant side effect;
- failure-domain labels are accurate;
- fixed-membership quorum arguments do not automatically extend across reconfiguration.

### D — heuristics / architecture hypotheses

- use lineage/event ancestry as the durable identity core;
- replicate relations rather than full entity state when relations form a sufficient statistic for all relevant future outcomes;
- combine geometric AOI with causal observer dependencies;
- use an irreversible frontier to decide when prediction must stop and strong evidence is required;
- select direct peer, relay and SFU topology from a measured Pareto frontier.

### E — empirical measurements required

- WebRTC/SCTP RTT, jitter, reorder, retransmission, buffering and head-of-line effects;
- ICE/STUN/TURN path distribution and reachability failures;
- browser background/suspension/resume behavior;
- IndexedDB / target-storage durability and loss behavior;
- target-mobile CPU, frame-time, thermal and battery cost of prediction/relay/recovery;
- real common failure domains across power, Wi-Fi, carrier, device and browser process;
- SFU versus peer/direct/relay crossover points;
- empirical prediction-error envelopes used by the speculation boundary;
- causal-horizon/AOI false-negative rate under real gameplay dependencies;
- latency/bandwidth/cost coefficients used for architecture selection.

### F — open

- unbounded machine-checked composition of election + commit + reconfiguration + semantic handoff;
- liveness/fairness under an explicitly chosen synchrony/failure-detector model;
- safe/lively dynamic membership under the exact desired peer/offline topology;
- Byzantine/Sybil/cheating behavior if peers can participate in Canon authority;
- authenticated certificate/key lifecycle;
- permanent/correlated storage loss and re-replication policy;
- automatic inference of arbitrary JavaScript/game invariants;
- proof that causal observer suppression beats a strong conventional AOI implementation on actual Rinne workloads;
- proof that any remaining Rinne-specific construction is novel relative to partial replication, distributed simulation, prediction and consistency literature.

## Fair comparison with known theory

Every baseline receives the same freedoms: semantic split, batching, interest management, topology selection, and an irreversible-only strong path. “Raft baseline” therefore means **Canon-only Raft**, not “put every realtime tick through Raft.”

### Strong replication / consensus families

- **Raft**: crash-fault replicated log, election, membership/reconfiguration machinery. Strong Canon can be a small Raft log without forcing realtime state into it.
- **Paxos / Multi-Paxos**: classic crash-fault consensus/replicated-log foundation.
- **Flexible Paxos**: shows that cross-phase quorum intersection, rather than identical majority quorums everywhere, is the key condition in its model.
- **Fast Paxos**: fast rounds trade latency against larger quorum/conflict constraints.
- **EPaxos**: leaderless command replication and dependency/conflict ordering; directly challenges blanket total-order requirements for commuting commands.
- **Viewstamped Replication**: primary/backup replication, view change and recovery/reconfiguration lineage.
- **Chain Replication**: strong fail-stop storage replication with throughput-oriented chain structure; membership/master concerns remain explicit.
- **PBFT / HotStuff**: Byzantine replication under their assumptions. If peers can lie, crash-only Canon is the wrong model rather than a cheaper substitute.

### Weak / semantic coordination families

- **Dynamo**: availability-first versioning/reconciliation baseline for weaker state.
- **CRDTs**: convergence for declared replicated data types.
- **RedBlue consistency**: explicit strong/weak operation split and transformations that expand the weak side. This is close prior art to Semantic Frontier's core motivation.
- **I-confluence / coordination avoidance**: the right comparison point for invariant-based coordination decisions; the local finite compiler is much weaker than the general formal framework.
- **CALM**: monotonicity characterizes coordination-free consistent computation in its logical setting.
- **causal consistency / COPS**: tracks dependencies and constrains visibility order.
- **eventual consistency**: valid only where the game permits convergence without immediate agreement.
- **HATs**: makes precise which guarantees can remain highly available under partition and which cannot.

### Realtime game / dissemination / simulation families

- **deterministic lockstep**: communicates inputs and reproduces deterministic simulation; low bandwidth but synchronization/determinism costs remain.
- **GGPO / rollback networking**: prediction, saved states and re-simulation for reversible interaction.
- **snapshot interpolation**: delayed interpolation of authoritative snapshots.
- **state synchronization**: runs local simulation while synchronizing selected state/input, avoiding full deterministic lockstep.
- **server-authoritative networking**: simple trust/order baseline when infrastructure is acceptable.
- **peer-host networking**: avoids a permanent realtime server but shifts trust/rehost/failure complexity to peers.
- **SFU**: established selective forwarding topology; solves fan-out placement, not application consistency.
- **gossip / epidemic dissemination**: eventual randomized propagation/anti-entropy.
- **multicast trees**: reduce sender fan-out at the cost of extra path/failure structure.
- **interest management / AOI**: long-established filtering of virtual-world updates. Observation frontier must extend this baseline rather than rename it.
- **HLA**: established distributed-simulation federation architecture; distributed simulation does not require one globally materialized Cartesian state at each tick.
- **optimistic simulation / Time Warp**: speculative event execution with rollback/anti-messages; speculative histories are established territory.

### Fair hybrid baselines for measurement

At minimum compare:

1. Canon-only Raft + authoritative realtime prediction/rollback + AOI/SFU.
2. CRDT/causal weak plane + Raft irreversible log + rollback realtime.
3. VR or Chain Replication strong plane + state synchronization realtime.
4. EPaxos-style dependency/conflict ordering + CRDT weak plane where assumptions fit.
5. peer-host realtime + external durable Canon service.
6. custom peer Canon candidate only under the same declared crash/BFT/storage assumptions.

Do not collapse them into a designer-weighted scalar winner before the product objective and coefficients are measured. Preserve the Pareto set when objectives conflict.

## Quantum mechanics: retained and rejected

| Concept | Physics meaning | Distributed abstraction | Verdict |
| --- | --- | --- | --- |
| entanglement + no-signalling | nonlocal correlations cannot carry controllable superluminal information | a remote device cannot react to new information without a causal information path | **A negative constraint**; no latency bypass |
| measurement | quantum measurement/state-update rule, interpretation-dependent details | “application fact becomes irreversible” | **discard as mathematics**; metaphor only |
| decoherence | environment-induced loss of observable coherence | no required game-network primitive | discard as protocol mechanism |
| environment as witness / Quantum Darwinism | selected information becomes redundantly accessible through environment fragments | redundant observable records resemble dissemination/replication | analogy only; classical replication/gossip already provides the usable mechanism |
| quantum uncertainty | quantum-state/observable limits | rollback prediction error | do **not** identify them; game uncertainty is classical estimation |
| causal/no-signalling horizon | influence cannot be used for arbitrary superluminal signalling | defer observer materialization before a sound causal lower bound | useful classical formalization; quantum label unnecessary |
| information/probability theory | quantitative information/uncertainty mathematics | coding, prediction and estimation | potentially useful mathematics, but not a quantum protocol |

No quantum computer, quantum channel, collapse mechanism or entanglement-based networking is assumed.

## Philosophy: formal residue only

| Idea | Formalization | Falsifier / invariant | Result |
| --- | --- | --- | --- |
| Heraclitus / process philosophy | mutable state is a projection/fold of event lineage | replay/projection must preserve every future invariant-relevant decision | useful design lens; technically event sourcing/process state |
| Nāgārjuna / dependent origination / relational ontology | replicate relationships rather than intrinsic records | relation state must be a sufficient statistic; hidden intrinsic state that later affects damage is a counterexample | conditional compression rule |
| Hume on causation | explicit causal dependency graph | omit one real dependency and causal suppression becomes unsound | ordinary causal consistency/interest reasoning |
| Kant / phenomenology | observer view differs from substrate/world representation | observers need equality only where game rules require shared facts | client projection / partial replication |
| structural realism | preserve invariant relations rather than byte-identical representation | all future relevant outcomes must depend only on preserved structure | candidate correctness criterion |
| Leibniz / continuity of identity | genesis + ancestry of identity-transforming events | irreversible identity ancestry must not fork | game-specific lineage model, adjacent to event sourcing/Merkle history |
| Parmenides / Cartesian global-state intuition | require one complete global state at every instant | partial replication, causal systems and distributed simulation are counterexamples to necessity | reject as default premise |

The philosophers are not authorities for protocol correctness. Their surviving ideas are evaluated only after translation into testable conditions.

## Reconstructed architecture for 輪廻転焦

No new grand protocol name is assigned because the general mechanisms are established.

### 1. Observer projection plane

Filter by geometry **and declared causal dependencies**. An event is sent/materialized when it can affect the observer's permitted outputs or when a prefetch margin requires it.

A causal observation horizon is usable only with a complete dependency graph and sound lower-bound delays. Otherwise fall back to conventional AOI/interest management.

### 2. Reversible realtime plane

Movement, animation and rollbackable combat state use the fastest topology consistent with the trust model:

- authoritative prediction/reconciliation;
- peer-host + prediction where appropriate;
- GGPO-like rollback when deterministic save/load is practical;
- state synchronization or snapshot interpolation otherwise.

Temporary observer disagreement is allowed. The contract is bounded correction, not one shared tick.

### 3. Confluent / causal plane

Monotone discoveries and genuinely mergeable facts use CRDT/causal/eventual mechanisms only when declared semantics establish safety. Unknown effects escalate rather than being guessed safe.

### 4. Irreversible Canon plane

Deaths/rebirth lineage, unique ownership/consumption, irreversible rewards and other nonrollbackable shared facts enter a small strong plane.

Start with a mature crash-fault replicated log/service such as Raft/VR/Paxos-family infrastructure rather than custom peer consensus. If malicious peers can participate as replicas, keep authority trusted or adopt an explicitly Byzantine design.

Consensus orders the irreversible facts that actually need it. It does not carry every realtime tick.

### 5. External effect plane

Payments, platform inventory and third-party persistence retain their own idempotency/transaction/outbox contract. A local Canon commit is not evidence that an external system performed its side effect.

### 6. Reconfiguration plane

Membership and semantic-policy changes are strong state. Generation changes must be chained/fenced through the same authority model. Do not run a local handoff protocol beside an unrelated consensus membership protocol and assume their safety predicates compose.

## World model after reconstruction

The game does not require one fully materialized Cartesian world state shared by all players at one tick.

Use distinct types:

- **durable fact history**: irreversible facts with agreed ancestry/order;
- **causal/mergeable facts**: partially ordered or convergent information;
- **observer projection**: what one client currently needs to render/decide;
- **speculative local trajectory**: reversible predicted state;
- **external facts**: facts whose authority belongs to another service.

Observer-visible state and durable world truth are intentionally different types. They coincide only where game invariants require it.

## Identity and relationship replication

Entity ID remains an address. Irreversible identity can additionally be represented as:

`identity = genesis + ordered identity-transforming ancestry`.

Mutable presentation state is a projection over that lineage and current local/causal facts. This fits a reincarnation game but is not a new general distributed-identity theorem.

Relationship-only replication is valid only under a **sufficient-statistic condition**: if two hidden world states have the same replicated relation state, every future permitted input sequence in the declared horizon must produce the same observer-visible and irreversible outcomes. One counterexample invalidates the compression.

## Classical uncertainty / speculation budget

The retained uncertainty rule is classical:

- `epsilon(t)` = defensible upper bound on prediction error relevant to a rule;
- `margin(t)` = distance to the nearest discrete/irreversible decision boundary;
- speculate only while the output is rollbackable and `epsilon(t) < margin(t)`;
- reconcile before the inequality can fail or before any external/irreversible boundary.

`epsilon(t)` is **E empirical** for real gameplay. This is not Heisenberg uncertainty.

## Impossibility / lower-bound boundary

The architecture does not claim to defeat:

- FLP liveness limits in full asynchrony with crash faults;
- CAP consistency/availability trade-offs under partition;
- quorum/intersection requirements of the chosen strong protocol;
- communication needed when new information on one device must causally change another device's output;
- information-theoretic bits needed to distinguish genuinely different observer outputs;
- Byzantine replica requirements when arbitrary faults are in scope;
- client knowledge limits after uncertain completion and permanent disappearance.

There is no theory-only proof that the Rinne mix beats every fair hybrid in latency/bandwidth. That question needs a real workload distribution and measured parameters.

## Stop condition for this reconstruction loop

The loop stops here only because every identified obligation is assigned to one of four destinations:

1. **closed by conditional reasoning**: majority/failure-domain geometry, client-timeout ambiguity, composition and direct-membership counterexamples, conditional causal horizon;
2. **delegated to established theory**: consensus/replication, CRDT/causal consistency, rollback/state-sync, interest management, distributed simulation and membership reconfiguration;
3. **retained as bounded executable evidence**: node-local model, state-space search, mutation/counterexample suite;
4. **empirical/open**: physical performance/durability, Byzantine threat, unbounded composition/liveness, workload optimality and novelty.

This stopping condition is itself falsifiable. A new counterexample or an unclassified obligation immediately reopens the loop.

## Primary / canonical references

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
- Bailis et al., **Highly Available Transactions**: <https://amplab.cs.berkeley.edu/publication/highly-available-transactions-virtues-and-limitations/>
- GGPO: <https://www.ggpo.net/> and <https://github.com/pond3r/ggpo/blob/master/doc/DeveloperGuide.md>
- Fiedler, **Snapshot Interpolation / State Synchronization**: <https://gafferongames.com/post/snapshot_interpolation/> and <https://www.gafferongames.com/post/state_synchronization/>
- Jefferson, **Virtual Time / Time Warp**, DOI `10.1145/3916.3988`
- IEEE 1516-2025, **High Level Architecture (HLA)**: <https://standards.ieee.org/ieee/1516/6687/>
- Demers et al., **Epidemic Algorithms for Replicated Database Maintenance**, DOI `10.1145/41840.41841`
- Liu and Theodoropoulos, **Interest management for distributed virtual environments: A survey**: <https://research.ibm.com/publications/interest-management-for-distributed-virtual-environments-a-survey>
- RFC 7667, **RTP Topologies / Selective Forwarding Middlebox**: <https://www.rfc-editor.org/rfc/rfc7667.html>
- Bruss et al., **Approximate quantum cloning and the impossibility of superluminal information transfer**: <https://journals.aps.org/pra/abstract/10.1103/PhysRevA.62.062302>
- Ollivier, Poulin, Zurek, **Environment as a witness**: <https://journals.aps.org/pra/abstract/10.1103/PhysRevA.72.042113>
- Riedel and Zurek, **Quantum Darwinism in an Everyday Environment**: <https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.105.020404>

## Novelty claim

No new general consensus theorem is claimed.

The remaining **F novelty candidates** are the Rinne-specific composition of:

1. observer projection driven by a causally complete game dependency graph rather than geometry alone;
2. measured speculation margin tied explicitly to irreversible gameplay boundaries;
3. lineage identity as the durable core of a reincarnation game while most presentation state remains partial/speculative;
4. invariant/effect declarations that route operations to established consistency mechanisms and fail closed on unsupported semantics.

Each may still reduce to known partial replication, event sourcing, robust prediction or invariant-routing work. Until residual literature review and empirical comparison close that gap, they remain candidates only.
