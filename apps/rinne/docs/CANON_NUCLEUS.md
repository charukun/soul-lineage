# Canon Nucleus architecture proof

## Scope

Canon Nucleus is the crash-fault authority path for Rinne's irreversible history. It is not a claim of a universally superior consensus algorithm. The product-specific requirement remains:

- no mandatory dedicated game server for the DEV slice;
- already confirmed birth/death/rebirth/lineage Canon survives the declared crash budget;
- loss of sufficient authority must fail closed instead of inventing history;
- replaceable realtime state does not enter the irreversible-history strong path;
- recovery must contain enough application state, including operation dedupe, to resume the confirmed history;
- the 30-player room must not require a full player mesh merely to protect Canon.

The original state proof is `src/game/reality-lab/canon-nucleus.js`. Packet-level crash timing is modeled separately in `canon-packet-proof.js`; dense presence fan-out is modeled in `adaptive-relay.js`. `proof-loop.js` composes these with Reality Lab and Semantic Frontier evidence without treating model results as physical WebRTC certification.

## Semantic planes

1. **Presence / realtime**: position, yaw, animation and other replaceable state. Newer state may supersede older state and may use Interest, Cell or adaptive relay distribution.
2. **Recovery state**: bounded material required to reconstruct the latest accepted Canon boundary. Realtime progress after that boundary may roll back.
3. **Canon**: irreversible birth, death, rebirth, lineage and equivalent history decisions.
4. **Authority**: epoch, fencing, quorum membership and proof that a successor can reconstruct the accepted Canon before it becomes `OPEN`.

The core invariant is unchanged:

> **Committed Canon must be Recovery-Complete.**

A hash or event ID by itself is not enough. The same durable proposal contains Canon payload plus recovery material. Application-level dedupe state such as `rebirthOps` belongs to that recovery capsule; an in-memory request map alone cannot prove idempotency after process replacement.

## Packet-level commit contract

The earlier proof assumed that an acknowledged replica was already durable. The packet model now makes that boundary explicit.

1. The current leader durably stores a complete `PREPARE(epoch, revision, parent, operationId, canon, recovery)`.
2. Followers may receive, lose, duplicate or reorder `PREPARE` packets. A follower emits `ACK` only after the complete proposal is stored.
3. The leader counts unique ACKing holders, including itself. **Client-visible Canon is forbidden until a quorum of currently live nodes durably holds the exact proposal.** A historical ACK from a holder that has already failed is insufficient.
4. After visibility, `COMMIT` dissemination may mark additional replicas, but safety does not depend on every follower seeing that packet before the leader fails.
5. If a holder disappears and the accepted revision falls below the durability quorum, the authority is `RECOVERING`, not fully `OPEN`, until the exact proposal is repaired across a live quorum.
6. Epoch fencing rejects delayed old-authority `PREPARE`/`COMMIT` traffic after recovery.

This yields an important uncertain-completion rule. A follower may have durably stored an operation even if its ACK never reached the old leader and the client never received success. A successor may conservatively finish that pending operation. Therefore the client must retry with the same stable operation ID, and the recovery capsule must retain the dedupe information needed to return the same result rather than create a second irreversible event.

### Crash timing now exercised

For the 3-member `f=1` case, the proof walks every member failure across these stages and all one/two-follower ACK sets:

- before any follower store;
- after durable follower store but before ACK delivery;
- after ACK but before client-visible commit;
- after client-visible commit but before follower COMMIT dissemination;
- after partial COMMIT dissemination.

A visible revision must survive and be repaired to a live quorum after every allowed single crash. If the only ACKing follower dies before visibility, publication is blocked until the other follower stores the proposal. This closes the gap between "an ACK once existed" and "the confirmed Canon is still crash-safe now".

The proof deliberately retains the inverse counterexample: if a leader is allowed to tell the client "committed" while only its own durable copy exists, one allowed leader crash can erase that visible Canon. The unsafe variant must fail in the suite.

## General crash-quorum form

For a crash budget `f` and a requirement to remain writable after those `f` failures, the model generalizes the nucleus to:

```text
members N = 2f + 1
commit / reopen quorum Q = f + 1
minimum committed copies for survival = f + 1
```

Any two `Q`-member majorities of a `2f+1` set intersect. If a committed proposal exists on `f+1` members, any set of at most `f` crashes leaves at least one complete proposal copy. Exactly `f` crashes also leave `f+1` live members, so the surviving copy can be repaired across a new quorum before reopening.

The automated proof currently enumerates `f=1..4`, all majority-quorum pairs and all size-`f` failure sets. It also keeps the minimal-member counterexample: with only `2f` members, `f` crashes leave `f` live nodes, fewer than the `f+1` majority required to resume writable crash-consensus.

These are standard majority/crash-fault bounds expressed in Rinne's recovery-complete state model, not a new consensus lower bound.

### Why two peers are still a boundary

With exactly two peers, arbitrary partition and no external witness/fencing service, the desired combination cannot be guaranteed simultaneously:

- if A must be able to stay/open alone after B crashes, A needs an "open alone" rule;
- if B must be able to stay/open alone after A crashes, B needs the symmetric rule;
- during a partition where both are alive but cannot distinguish the other from a crash, both rules can fire and violate split-brain safety.

If one side is forbidden to open alone, the corresponding real single-peer crash loses availability instead. The proof exhausts the four possible `A may open alone / B may open alone` policies and finds none satisfying both one-peer post-failure availability and partition split-brain safety.

This boundary assumes arbitrary partition without an external witness, fencing authority or trusted bounded-drift lease. Adding such a discriminator changes the model and may solve the two-peer product case; the current peer-only proof does not pretend otherwise.

## Finite burst, duplicate and reorder model

`canon-packet-proof.js` also drives deterministic message faults:

- consecutive loss bursts followed by eventual delivery;
- duplicate `PREPARE`, `ACK` and `COMMIT` packets;
- reordering by choosing delivery order from the pending queue;
- delayed old-epoch packets after successor recovery;
- permanent loss/partition as a no-liveness boundary.

Safety is maintained because storage and ACK handling are idempotent by `(epoch, revision, exact proposal)`, ACKs are counted by unique member, visibility still requires a currently-live durable quorum, and stale epochs are fenced. A finite loss burst can make progress once delivery resumes and retries occur. An infinite partition has no guaranteed Canon liveness and is not relabeled as a slow success.

This is an adversarial deterministic packet model. It is **not** evidence about SCTP retransmission algorithms, browser scheduling, NAT, TURN, carrier radio sleep or real burst-loss distributions.

## Original f=1 lower-bound and cost result

For the default 3-member case, crash survival needs at least two independent copies. The leader already owns one copy, so one follower durable store is the minimum synchronous transfer before visibility.

Let `R > 0` be replaceable realtime bytes during an interval and `C` the Canon plus recovery bytes required by both compared designs. A three-replica all-state design that strongly logs every realtime transition must transfer at least one follower copy of `R + C`, while Canon Nucleus transfers one follower copy of `C`:

```text
all-state minimum commit path = R + C
Canon Nucleus minimum commit path = C
minimum commit-path saving = R > 0
```

Keeping both standbys warm yields `2 × (R + C)` versus `2 × C`. The existing deterministic cost sweep covers 6,480 combinations across player count, ticks, realtime payload, Canon frequency/payload, recovery payload and reliable-delivery multiplier.

For 30 players, the structural host-star+nucleus topology is 29 host/client edges plus one standby-to-standby edge = 30 unique peer edges, versus `30 × 29 / 2 = 435` full-mesh edges. This is a topology fact, not browser throughput certification.

## Position relative to known theory

Canon Nucleus specializes existing ideas rather than replacing them.

- Raft-style majority replication supplies the crash-consensus/leader-safety foundation. Rinne narrows the strong path to irreversible Canon plus recovery rather than declaring every gameplay transition strongly ordered. See `https://raft.github.io/raft.pdf`.
- Paxos/Raft majority intersection is the basis of the generalized `2f+1 / f+1` crash-quorum rule; the Rinne-specific piece is the recovery-complete semantic payload and gameplay boundary.
- RedBlue Consistency already establishes the general idea that only operations needing strong consistency should pay strong coordination. Canon Nucleus is a game-specific specialization, not a new general consistency class. See `https://www.usenix.org/conference/osdi12/technical-sessions/presentation/li`.
- GGPO-style rollback shows how reversible gameplay can trade rollback for responsiveness. Confirmed birth/death/rebirth history is intentionally outside that rollback domain. See `https://www.ggpo.net/`.

An equally specialized architecture with the same semantic split and crash assumptions can match the same lower bounds. The claim is constrained: Rinne reaches those bounds without forcing replaceable realtime traffic through the Canon strong path.

## Presence fan-out remains a separate problem

The existing Reality Lab retains a counterexample where all 30 players are dense in one Cell, so fixed spatial Cell authority provides almost no busiest-sender fan-out benefit. This does not weaken Canon safety; it means presence distribution needs a separate strategy.

`adaptive-relay.js` now supplies that candidate for replaceable presence only. It is prohibited for Canon/authority messages. The architecture can therefore change dense realtime fan-out without making irreversible history depend on the relay tree.

## Reproducible checks

Existing Canon checks:

```sh
node --test apps/rinne/tests/reality-canon-nucleus.test.mjs
```

Packet/generalization/relay theory checks:

```sh
node --test apps/rinne/tests/reality-theory-verification.test.mjs
```

Combined architecture loop:

```sh
node apps/rinne/scripts/reality-architecture-proof.mjs
```

The combined loop must keep old counterexamples visible while also requiring the packet interleaving, two-peer boundary, finite-burst boundary and dense adaptive-relay proof to pass.

## Still not proved by this model

- Byzantine/colluding peers, Sybil resistance or anti-cheat;
- a cryptographic commit certificate against malicious participants;
- real browser background/suspension timing or radio behavior;
- physical 30-device throughput/latency/energy certification;
- NAT/TURN reachability or SCTP implementation behavior;
- zero rollback for replaceable realtime after the latest accepted recovery boundary;
- cloud durability after all authority devices are lost.

Those require separate assumptions and evidence. A physical capture can validate performance of an already-defined protocol, but it cannot repair a missing safety proof, so those evidence tracks stay separate.
