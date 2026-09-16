# RRP theory verification ledger

This ledger separates claims that can still be decided by deterministic reasoning from claims that need physical evidence. Every positive claim has a failure model; retained counterexamples are part of the proof surface.

## Current proof ledger

| Claim | Verification | Boundary retained |
| --- | --- | --- |
| confirmed Canon is recovery-complete | exact proposal contains Canon + application recovery + operation-dedupe state | a hash/event ID alone is insufficient |
| ACK means durable proposal exists on that follower | explicit PREPARE → durable store → ACK state machine | packet receipt by the leader is not itself durability |
| client-visible Canon survives declared crash budget | visibility requires a currently-live durable quorum | a holder that ACKed and then died no longer satisfies visibility |
| f=1 crash timing safety | 45 store/ACK/visibility/partial-COMMIT × member-failure cases | unconfirmed prepared work may be lost or conservatively completed |
| generalized crash recovery | 5,218 protocol cases across f=1..3, every leader, commit majority and size-f crash set | Byzantine behavior is outside this model |
| generalized majority geometry | all majority pairs and size-f failure sets for f=1..4 under N=2f+1, Q=f+1 | 2f members cannot retain Q live after f failures |
| bounded arbitrary scheduling | state-space exploration over delivery/drop/crash/publish/recovery ordering | bounded one-operation f=1 exploration is not an unbounded model checker |
| uncertain completion is idempotent | recovery carries operation-dedupe map; current/older stable-ID retries cannot create a new revision | client must retry the same operation ID |
| epoch/history ancestry survives recovery | sequential uncertain completion → recovery/new epoch → retry → next Canon + stale epoch injection | successor cannot jump around latest visible parent root |
| false suspicion does not permit old Canon commits | new authority epoch requires a quorum fence; every old majority intersects the new voting majority | failure detection itself is not guaranteed or bounded-time |
| minority authority promotion | minority component cannot acquire the Canon quorum | availability is sacrificed rather than self-promoting |
| timeout-only promotion is unsafe | retained self-promotion counterexample has a disjoint old commit majority | timeout alone is not a fencing certificate |
| early visibility is unsafe | deliberately unsafe one-copy publication loses visible Canon after one leader crash | retained required failing counterexample |
| finite burst loss safety | exact 0..16 dropped protocol rounds, then eventual delivery; duplicate/reorder/stale-epoch tests | permanent partition has no strong-Canon liveness guarantee |
| two-peer peer-only availability boundary | exhaustive A/B "may open alone" table | arbitrary partition + no external witness cannot give symmetric one-peer availability and split-brain safety |
| suspended authority rotation | one-member old/new common-majority bridge, f=1..4 | if old majority is already lost, rotation fails closed |
| bulk membership change | direct disjoint-majority counterexample retained | use sequential one-member replacement or real joint consensus |
| crash copies imply domain durability only with placement diversity | holder-domain sweep f=1..3 | f+1 copies in one shared failure domain are not f-domain tolerant |
| dense fixed-Cell fan-out is not enough | existing 30-player dense Cell counterexample retained | spatial partition alone is not universal |
| dense adaptive relay lowers sender fan-out | balanced construction reaches pigeonhole lower bound for 3..64 players, redundancy 1..2 | extra hop/failure exposure remains |
| 30-player r=1 relay frontier | 29 direct fan-out → 5 relays / max sender fan-out 5 / 29 transmissions | no one-relay-path tolerance |
| 30-player r=2 relay frontier | 7 relays / max sender fan-out 7 / 51 transmissions | one relay-path failure tolerant but more aggregate traffic |
| redundant relays need domain diversity | correlated-domain relay counterexample | two relays sharing one failed domain are not independent |
| SFU/external fan-out remains a valid frontier point | explicit topology comparison retains lower player fan-out when infrastructure is allowed | no-infrastructure constraint correctly selects peer alternatives |
| relay cannot weaken Canon | relay planner rejects irreversible/total-order/crash-survival operations | Canon remains on strong path |
| invariant conflicts can be compiled | bounded counter / grow-only set / unique register / single-use token compiler emits witness-backed coordination kernel | undeclared or richer application semantics remain outside proof |
| weak operation can remain weak beside strong conflicts | compiled mixed workload keeps safe mergeable state weak while witnessed stock conflicts cannot use weak policies | total-order escalation is conservative, not globally cheapest |
| planner result carries its assumptions | proof-carrying bundle binds invariant certificate + environment + objective + selected policy/cost | certificate cannot prove an omitted invariant |
| certificate/policy tampering | recomputation rejects changed conflict set, selected policy or cost | cryptographic adversary/authentication is not modeled by the display digest |
| cross-policy transition safety | source PREPARE is invalidated by later source writes; durable fence closes old generation before target opens | transition may stall; zero-stall switching is not claimed |
| late old-policy messages | generation fencing rejects writes from earlier policy epochs after activation | richer policy-specific metadata translation still needs adapters |
| direct policy switch is unsafe | retained split-policy counterexample accepts divergent writes when target opens before fence | old/new simultaneous authority is forbidden |
| Semantic Frontier composition | presence, crash Canon, Byzantine and external-order escalation stay distinct | Byzantine/external effects are not relabeled as peer crash-safe Canon |
| universal strict dominance | explicitly false | lower bounds, CAP and FLP remain hard boundaries |

## Theoretical saturation point

Inside the declared **protocol-following crash-fault + bounded invariant model**, the major hidden assumptions have now been pulled into explicit state machines or explicit counterexamples:

- storage-before-ACK and live-quorum-before-visibility;
- packet ordering, loss, duplicate delivery and uncertain completion;
- generalized 2f+1 / f+1 crash geometry;
- quorum-fenced epoch change under false suspicion;
- membership rotation and background/suspended members;
- failure-domain independence rather than raw copy count;
- dense presence fan-out and peer-relay/SFU trade-offs;
- invariant-derived coordination rather than manually marking every operation strong;
- proof-carrying policy selection;
- fenced handoff between different consistency policies.

That is a materially stronger stopping point than the earlier atomic `replicate -> migrate` model. More deterministic modeling can always enlarge the state space, but remaining claims now fall into one of three categories: a deliberately unsupported failure model, an application semantic not yet declared to the compiler, or a physical quantity the model must not invent.

## Deliberate theory boundaries

### Byzantine / malicious participants

Canon Nucleus assumes protocol-following peers that may crash. Lying durable-storage ACKs, collusion, Sybil identities or conflicting signatures change the failure model. Semantic Frontier escalates such work to a Byzantine policy; this project does not claim that three crash-only peers solve BFT or anti-cheat.

### Arbitrary program semantics

Invariant compilation is exact only for its declared resource/effect algebra. Arbitrary JavaScript, cross-resource business rules and hidden side effects cannot be inferred safely. Unknown semantics must be declared, proven with a richer compiler, or conservatively coordinated.

### Arbitrary bulk reconfiguration

One-member rotation through a common-majority bridge is certified. Larger membership jumps need sequential replacement or a joint-consensus protocol.

### Guaranteed strong progress under permanent partition

Strong Canon deliberately sacrifices availability without quorum. CAP/FLP boundaries are preserved, not disguised with shorter timers.

### Universal presence optimum

The relay construction is optimal only inside the declared two-level balanced-relay fan-out objective. SFU and future policies remain valid Pareto candidates. Runtime choice needs measured latency/queue/device costs before any adaptive threshold can be calibrated.

## What now requires physical evidence

The next unresolved questions are predominantly empirical:

- actual RTT added by one relay hop;
- real SCTP buffering/retransmission under burst loss;
- ICE/TURN reachability and selected path distributions;
- browser background/suspension timing versus pre-rotation time;
- Pixel-Fold-class frame/CPU/queue cost while relaying;
- physical correlation of Wi-Fi, power, carrier and device failure domains;
- battery/radio cost;
- whether measured thresholds justify switching among direct, relay or infrastructure-assisted presence paths.

A fast physical run cannot rescue a failed safety proof, and a deterministic proof cannot certify physical performance. Both evidence classes remain separate in `RRP_PERFORMANCE_CONTRACT.md`.

## Commands

```sh
node --test \
  apps/rinne/tests/reality-canon-nucleus.test.mjs \
  apps/rinne/tests/reality-semantic-frontier.test.mjs \
  apps/rinne/tests/reality-theory-verification.test.mjs \
  apps/rinne/tests/reality-canon-state-space.test.mjs \
  apps/rinne/tests/reality-invariant-compiler.test.mjs \
  apps/rinne/tests/reality-policy-handoff.test.mjs \
  apps/rinne/tests/reality-epoch-election.test.mjs
node apps/rinne/scripts/reality-architecture-proof.mjs
```

A combined pass must retain the old dense-Cell, unsafe early visibility, timeout-self-promotion, direct membership switch and direct policy-switch counterexamples as well as the model/physical evidence boundary.
