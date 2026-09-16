# Canon Nucleus architecture proof

## Scope

This note records the proof target for Rinne's 30-player cooperative DEV model. It does not claim a universally superior multiplayer or distributed-systems theory. The fixed requirement envelope is:

- no mandatory dedicated game server for the DEV slice;
- one nucleus device may fail without losing already committed birth/death/rebirth canon;
- loss of quorum must fail closed instead of inventing a successor history;
- replaceable realtime state must not be forced through the irreversible-history commit path;
- the topology must remain practical for a 30-player mobile/browser room.

The proof implementation is `src/game/reality-lab/canon-nucleus.js`. The existing Reality Lab remains the source for realtime fan-out, Interest, Cell, host-loss and corruption experiments. `proof-loop.js` composes both evidence sets without pretending that the model wire certifies real NAT/TURN/WebRTC behavior.

## Semantic planes

The architecture separates four meanings that do not require the same consistency level.

1. **Presence / realtime**: position, yaw, animation and other replaceable presentation state. A newer sample supersedes an older one.
2. **Recovery state**: the bounded material required to reconstruct the last committed canon boundary. Realtime progress after that boundary may be discarded on failure.
3. **Canon**: irreversible birth, death, rebirth, lineage and equivalent history decisions.
4. **Authority**: leader epoch, fencing and proof that a successor has the committed recovery material before OPEN.

A canon operation is not committed merely because a leader chose it. The same canon payload and its recovery material must be stored by a 2-of-3 nucleus quorum. Only then may that revision become visible as committed history.

The recovery capsule must contain the application-level deduplication state needed after process replacement. In the current Rinne coop model, rebirth requests are already represented by stable operation/life identifiers and the `rebirthOps` state belongs with the recoverable checkpoint. An in-memory operation map alone is not sufficient evidence for cross-Host idempotency.

## Safety argument

For a three-member set, every two-member quorum intersects every other two-member quorum. A committed revision therefore exists on at least two members at commit time.

After any single member failure, two members remain. The surviving set intersects the previous commit quorum, so at least one live member retains the complete committed canon/recovery pair. Before a replacement leader opens a new epoch, that pair is copied and validated across the live quorum. The successor cannot silently choose an older revision.

After two member failures, fewer than two members remain. No quorum can be formed, so the model moves to CLOSED. Availability is intentionally sacrificed rather than fabricating history.

A healthy OPEN leader cannot be replaced through the recovery API. Epoch fencing rejects writes from an older authority epoch. Operation IDs are idempotent within the protocol model: replaying the same operation with the same payload returns the original receipt, while reusing the same ID with different content is rejected. Cross-process deduplication additionally depends on the recovery-capsule rule above.

The proof model verifies the actual payload structure as well as the displayed digest, so its internal safety result does not depend on an accidental collision in the display checksum. This is still a non-Byzantine proof: a malicious member that intentionally violates the protocol is out of scope.

## Crash-tolerance lower bound

With no external durable authority and a target of surviving `f=1` crash, a committed canon item must exist on at least `f+1 = 2` independent members. If only one member holds it, that member is itself an allowed single failure and the committed canon can disappear.

The leader already owns one copy, so the minimum synchronous commit-path transfer is one follower copy. Canon Nucleus commits at exactly that lower bound: leader + one acknowledged follower. After leader loss, the surviving committed copy is copied to the other live nucleus member before the replacement leader becomes OPEN.

This lower bound is about crash safety, not Byzantine consensus or geographic failure domains. If the two copies share a common physical failure domain, the practical durability claim must be weakened accordingly.

## Constrained dominance

Comparisons are made only among architectures that satisfy the same one-crash canon requirement. A single-host star remains useful as a low-cost reference, but it is not a feasible baseline for one-host-loss canon survival.

Let `R > 0` be replaceable realtime bytes generated during the interval and `C` the canon plus recovery bytes required by both designs. On the minimum commit path, a three-replica all-state design that includes every realtime transition in its strongly ordered log must transfer at least one follower copy of `R + C`, while Canon Nucleus transfers one follower copy of `C`:

```text
all-state minimum commit path = R + C
Canon Nucleus minimum commit path = C
minimum commit-path saving = R > 0
```

If both standby replicas are kept warm, the corresponding traffic is `2 × (R + C)` versus `2 × C`, preserving the same strict inequality. The deterministic proof sweep varies players, ticks, realtime payload, canon frequency, canon payload, recovery payload and reliable-delivery multiplier. The current sweep covers 6,480 combinations and requires both minimum-commit and two-standby inequalities to hold in every case.

For 30 players, a host-star plus a three-member nucleus needs 29 host/client edges plus the one standby-to-standby edge not already present in the star: 30 unique peer edges. A 30-player full mesh has `30 × 29 / 2 = 435` edges. Both numbers describe topology, not a claim that every browser can sustain the resulting traffic.

During a pending canon commit, only the canon-affected actors need to be held at the irreversible boundary. Other reversible simulation can continue until the existing global stall budget is exceeded. A monolithic all-state commit barrier blocks the entire authoritative simulation for the same durability wait. This selective-progress property is part of the fixed comparison model, not a universal statement about every replicated-state-machine implementation.

## Position relative to known theory

Canon Nucleus does not claim to replace or invalidate the underlying theories it uses.

- Raft-style replicated logs establish the majority-commit and leader-safety foundation. Canon Nucleus narrows what must enter that strong path to irreversible canon plus its recovery material rather than every replaceable gameplay transition. See `https://raft.github.io/raft.pdf`.
- RedBlue Consistency already demonstrates the general principle that operations may be classified so only those requiring strong consistency pay coordination cost. Canon Nucleus is a game-specific specialization with an explicit recovery-complete canon boundary and 30-player peer topology, not a new general consistency class. See `https://www.usenix.org/conference/osdi12/technical-sessions/presentation/li`.
- GGPO-style rollback demonstrates that speculative/replaceable gameplay can trade rollback for responsiveness. Rinne cannot apply that rule to an already committed life/death/rebirth history, so rollback techniques belong only on the realtime side of the boundary. See `https://www.ggpo.net/`.

The proven advantage is therefore constrained but meaningful: for Rinne's requirement set, Canon Nucleus reaches the minimum two-copy crash-safety bound for irreversible canon while removing `R` from the synchronous strong path and avoiding a full mesh. An equally specialized known architecture that makes the same semantic split can match this bound; the proof does not claim a lower communication cost than that theoretical optimum.

## Counterexamples retained

The combined proof loop deliberately keeps results that defeat simplistic claims. In the current Reality Lab, Cell distribution materially reduces busiest-peer load in spread layouts, but provides almost no fan-out advantage when all players are dense in one cell. The architecture therefore does not claim that Cell distribution is always superior; it composes semantic canon with whatever presence strategy the measured room layout justifies.

Likewise, packet loss can delay liveness. Canon safety is protected by refusing to commit without quorum rather than by assuming delivery. Burst-loss, SCTP retransmission behavior, NAT, TURN, device sleep and radio behavior require a different evidence layer.

## Reproducible checks

Focused theorem/state-machine checks:

```sh
node --test apps/rinne/tests/reality-canon-nucleus.test.mjs
```

Full fixed Reality Lab comparison loop:

```sh
node apps/rinne/scripts/reality-architecture-proof.mjs
```

The focused checks exhaust all three two-member commit quorums against all single-node failures and all two-node failure sets, verify quorum-before-commit, recovery-material integrity, healthy-leader fencing, stale epoch rejection, operation conflicts, the one-failure copy lower bound and the 6,480-case cost sweep.

The full loop covers clean spread/dense, WAN-like delay/jitter/loss, adverse dense loss, Host failure, lossy Host failure, Cell failure, corruption repair and collapse/revisit. A passing report also requires the dense counterexample, the spread benefit, host recovery and corruption repair to remain visible.

## Not proved here

- Byzantine or colluding peers, Sybil resistance or anti-cheat;
- physical 30-device certification or Pixel Fold performance;
- NAT/TURN reachability, carrier-network behavior or SCTP implementation details;
- burst-loss or radio-sleep behavior;
- zero rollback for replaceable realtime state after the latest committed recovery capsule;
- cloud durability after all nucleus devices are lost.

Those claims require their own adapters and evidence and must not be inferred from this model proof.
