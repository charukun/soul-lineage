# RRP reconstruction: fair comparison and primary-source register

Companion to [the reconstruction](THEORY_RECONSTRUCTION.md). Reviewed 2026-09-17. These are technical comparisons and reproducible experiment specifications, not a benchmark claiming that every listed stack was implemented. Published theorem statements retain their failure, communication, consistency and availability assumptions.

## Equal freedoms, equal obligations

Every candidate may split replaceable realtime, mergeable facts, irreversible Canon, recovery and authority. Every candidate may use the same AOI/dependency pruning, delta codec, batching, compression, prediction/rollback, topology choice, external service and hardware allocation. A baseline is not forced to put every animation tick in its consensus log.

For an apples-to-apples run fix: accepted command history and rules; client-visible irrevocability/rollback contract; tolerated failures and failure domains; Byzantine versus cooperative peers; membership behavior; durable storage semantics; payload/codec; node locations; loss/sleep trace; link limits; external service cost; and cold-start/catch-up state. Strong consistency cannot be traded away silently to obtain lower latency. Conversely, a baseline cannot be charged for a stronger guarantee RRP does not supply.

| Matched baseline | Construction and interpretation |
|---|---|
| Canon-only Raft | Identical realtime transport plus Raft only for Canon, receipts and recovery metadata. Removes the old all-state straw baseline. |
| CRDT + Raft | Proven mergeable facts use the same CRDT representation; scarce conflicts and Canon enter the same strong domain. Cross-domain invariants are charged identically. |
| Authoritative realtime + replicated irreversible log | Game host handles speculative/replaceable simulation; durable command service records decisions and validation dependencies. Peer-host and dedicated-host placements are separate variants. |
| SFU/relay + durable metadata quorum | Relay fan-out does not imply durable decisions. Count media/data relay implementation and quorum traffic separately; native RTP SFU is not automatically a WebRTC data-channel forwarder. |
| Rollback + external Canon service | Reversible interaction may roll back; the same irreversible boundary uses a declared external service. Include its availability, trust, latency and monetary cost. |
| Fixed known kernel + adaptive topology | The same kernel and semantic split as RRP, but a measured relay/AOI strategy. Any win here is a topology/control optimization, not a new consistency theorem. |

`trafficLedger()` is deliberately name-blind. Equal category totals tie. That test prevents an RRP label discount; it does **not** establish equal measured implementations or a positive RRP speedup.

## Consensus and replication families

| Family / primary source | What it contributes | Fair Rinne comparison and failure boundary |
|---|---|---|
| Raft [C1] | Replicated log, leader completeness and joint configuration transition | Allow Canon-only logs, batching, snapshots and local realtime. A minority cannot keep committing; Raft does not mandate global game ticks. |
| Paxos [C2] | Agreement through promises, accepted proposals and quorum intersection | Allow stable-leader Multi-Paxos and per-conflict logs. The reference's deliberately simple per-slot phases are not the fastest baseline. |
| EPaxos [C3] | Dependency-based ordering with fast paths for suitable nonconflicting commands | Account for conflict rate, dependency metadata and recovery. The 2026 EPaxos* repair [C3b] must inform the candidate; do not "win" against a known-broken recovery interpretation. |
| Flexible Paxos [C4] | Cross-phase intersection rather than majority in every phase | Small steady-state quorums trade against larger recovery/election quorums. Compare the entire availability envelope, not only healthy writes. |
| Fast Paxos [C5] | Fewer message delays in its fast path under stronger quorum conditions | Charge fast quorum size and collision recovery; do not treat all Paxos variants as one designer-assigned cost. |
| Chain Replication [C6] | Ordered update propagation and tail-serving architecture | Useful throughput baseline; chain length and repair/view management matter. Apply it only to the same protected state. |
| Viewstamped Replication [C7] | Crash replication, view changes and reconfiguration | Another legitimate Canon service, not an all-world-state requirement. Storage/replica survival assumptions must match. |
| PBFT [C8] | Byzantine state-machine replication under its authentication/fault model | Use the same adversarial envelope and 3f+1-style replica requirement of this model. A cooperative 3-peer crash quorum is not an equivalent anti-cheat baseline. |
| HotStuff [C9] | Partially synchronous BFT with linear communication in its specified protocol path | Count authenticator aggregation, leader changes, quorum configuration and finality. No inference that peer signatures alone supply its BFT guarantees. |

The EPaxos repair is important evidence about the *difficulty of recovery and composition*, not an argument that all existing protocols are unsound. Its authors identify ambiguity/correctness problems in earlier recovery and give a corrected construction. This review does not independently machine-check their proof. [C3b]

## Weak consistency and coordination

| Family / primary source | What survives | Limit that matters for this game |
|---|---|---|
| Dynamo [W1] | Availability-oriented versioned replication, reconciliation and repair | Quorum-looking settings alone do not establish linearizable Canon. Let it handle appropriate weak state in a hybrid. |
| CRDT [W2] | Convergence by a defined state/operation algebra and delivery premises | Convergence is not arbitrary game-invariant preservation. A convergent negative balance is still wrong. |
| RedBlue Consistency [W3] | Selective strong ordering rather than strongly ordering every operation | The general semantic-split principle is prior art. Operation classification and invariant preservation are the real obligations. |
| I-confluence / coordination avoidance [I1] | An invariant-based characterization of coordination needs in its transaction/merge model | Check reachable common ancestors and concurrent instances, including the same definition twice. Our one-step bounded checker is weaker than this theorem. |
| CALM [I2] | Logical monotonicity characterizes coordination-free consistent computation in its formal setting | Does not certify arbitrary mutable JS, uniqueness or a negative query merely because it is called "semantic." |
| Causal consistency [W4, L3] | Preserve happens-before/dependency exposure without one total world order | Two concurrent spends can both be causally valid and jointly violate a constraint. Add rights allocation/coordination where required. |
| Eventual consistency / gossip [W1, W5] | Disseminate and converge/repair under explicit delivery/merge assumptions | Eventual convergence is not a bound on staleness, finality or durability under permanent loss. |
| HATs [W6] | Separates transaction guarantees achievable with high availability from stronger unavailable combinations | Do not describe partition-available execution as serializable irreversible global truth. Use the precise model, not "CAP says all consistency is impossible." |

A correctly preallocated escrow/right scheme can sometimes keep bounded resources local. Allocating/transferring those rights has a coordination and durability contract; inventing unlimited rights on recovery destroys the invariant. The current reference does not implement an escrow protocol.

## Game networking, dissemination and simulation

| Family / primary source | Appropriate role | Counterexample or comparison condition |
|---|---|---|
| Deterministic lockstep [G1] | Send inputs and derive state with deterministic simulation | Input delay/slow participant and cross-platform determinism are costs. It already disproves "replication must copy entity state." |
| Rollback / GGPO [G2] | Speculative inputs, state save/restore and resimulation | External irreversible outputs cannot be casually undone. Count rollback depth, CPU and input prediction quality. |
| Snapshot interpolation [G3] | Render buffered authoritative samples smoothly | Pays buffering/age rather than resolving irrevocable game facts. Give every baseline the same interpolation policy. |
| State synchronization [G4] | Selectively transmit simulation state/corrections | Existing work already prioritizes partial object updates. Do not compare against compulsory full-world replication. |
| Server authoritative [G5] | Authority validates game behavior and distributes results | Trusted server is a trust placement, not automatically a durable replicated history. Add the same Canon service and account for cost. |
| Peer-host [G5] | A player device hosts authoritative simulation | Host loss, modified clients, uplink pressure and sleep matter. Use a replicated Canon sidecar when required, exactly as allowed to RRP. |
| SFU / selective forwarding [N1] | Reduce sender fan-out via a forwarding middlebox | Offloads work rather than abolishing receiver information demand. RTP topology specification is not a data-channel durability protocol. |
| Gossip / epidemic dissemination [W5] | Anti-entropy or rumor dissemination across peers | Reliability, duplicates, convergence time and communication differ by method. Neither supplies consensus by itself. |
| Multicast trees [N2] | Distribute shared data along a tree | Tree cuts need repair; native IP multicast availability cannot be assumed for a browser mesh. Application relay trees are a separate implementation. |
| Interest management / AOI [S1, G4] | Deliver subscribed spatial/semantic updates instead of everything | Dense rooms, global markets, projectiles and teleportation break purely local savings. Selection computation is itself a cost. |
| Distributed simulation / HLA DDM [S1] | Region/subscription matching and distributed-simulation data distribution | Spatial matching does not prove game conflict independence. HLA is a broad framework, not one consensus-cost coefficient. |
| Optimistic simulation / Time Warp [S2, S3] | Rollback using antimessages, virtual-time execution and commit/retention boundaries | Speculation versus irreversible output is prior art. In-flight messages and rollback causality cannot be ignored when advancing a safe boundary. |

Time Warp source access: the authors' RAND report/abstract and the primary SOSP operating-system publication were available. The original 1985 ACM PDF returned 403 and the RAND PDF renderer failed. No detailed algorithm or figure from those unavailable pages is claimed as inspected. GVT/commit-frontier integration therefore remains a refinement obligation, not a copied algorithm certified by this review.

## A measurement contract without a manufactured winner

Report a vector: total wire bytes, busiest-node uplink/downlink, message count, connection count, CPU/frame-time, memory/durable bytes, energy, p50/p95/p99 irrevocable-commit latency, recovery time, unavailable time, rollback/correction error and external monetary cost. Declare denominators and measurement windows; separate steady state, conflict bursts, cold joins, failover, membership changes and recovery. Capture framing, signatures, retransmissions, dropped work and handoff traffic, not just application payloads.

Use identical recorded commands and impairment schedules where meaningful, randomized run order and repeated runs; show uncertainty intervals and failures. Sparse/dense rooms, all players in one AOI, long-distance topology, pause/resume, correlated loss and client disappearance are mandatory adversarial workloads. Reachability/durability violations disqualify a plan for that envelope rather than giving it a cheap score. Missing measurements remain E.

Do not compare an offline planner with future trace knowledge to an online baseline. For a proposed switch with cost H, estimated per-time benefit delta and horizon T, delta*T > H is only an accounting prerequisite; estimation error, oscillation and failed migration require additional margin. A fixed baseline may still win. No universal strict dominance is possible when another candidate reproduces the identical plan.

## Sources

The keyed [primary-source register](THEORY_RECONSTRUCTION_SOURCES.md) records provenance and access limitations. Source keys above are not substitute claims of an implementation benchmark.
