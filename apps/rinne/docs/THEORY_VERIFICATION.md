# RRP theory verification ledger

This ledger separates claims that can still be decided by deterministic reasoning from claims that need physical evidence. It is intentionally stricter than a feature checklist: every positive claim has a failure model, and retained counterexamples are part of the proof surface.

## Current proof ledger

| Claim | Verification | Boundary retained |
| --- | --- | --- |
| confirmed Canon is recovery-complete | exact proposal contains Canon + application recovery + operation-dedupe state | a hash/event ID alone is insufficient |
| ACK means durable proposal exists on that follower | explicit PREPARE → durable store → ACK state machine | packet receipt by the leader is not itself durability |
| client-visible Canon survives declared crash budget | visibility requires a **currently-live** durable quorum | a holder that ACKed and then died no longer satisfies the visibility gate |
| f=1 crash timing safety | 45 store/ACK/visibility/partial-COMMIT × member-failure cases | unconfirmed prepared work may be lost or conservatively completed |
| generalized crash recovery | 5,218 actual protocol cases across f=1..3, every leader, commit majority and size-f crash set | Byzantine/malicious behavior is outside this model |
| generalized majority geometry | all majority pairs and size-f failure sets for f=1..4 under N=2f+1, Q=f+1 | with only 2f members, f failures leave fewer than Q live members |
| uncertain completion is idempotent | recovery carries operation-dedupe map; retrying current or older operations cannot create a new revision | client must retry with the same stable operation ID |
| epoch/history ancestry survives recovery | sequential A → uncertain B → recovery/new epoch → retry B → C proof plus stale-old-epoch injection | a successor may not jump to a proposal whose parent is not the latest visible Canon root |
| early visibility is unsafe | deliberately unsafe one-copy publication loses visible Canon after one allowed leader crash | retained as a required failing counterexample |
| finite burst loss safety | exact 0..16 consecutive dropped protocol rounds, then eventual delivery; duplicate/reorder/stale-epoch tests | permanent partition has no strong-Canon liveness guarantee |
| two-peer peer-only availability boundary | exhaustive A/B "may open alone" policy table | arbitrary partition + no external witness cannot provide both symmetric one-peer availability and split-brain safety |
| suspended authority rotation | one-member old/new common-majority bridge, f=1..4 intersection proof | if the old majority is already lost, rotation fails closed |
| bulk membership change | direct 3-node two-member replacement is rejected | use sequential one-member changes or a real joint-consensus protocol |
| crash copies imply domain durability only with placement diversity | durable-holder domain sweep for f=1..3 | f+1 peer copies in one shared failure domain are not f-domain tolerant |
| dense 30-player fixed-Cell fan-out is not enough | existing dense Cell counterexample retained | spatial partition alone is not a universal fan-out answer |
| dense adaptive relay lowers sender fan-out | exact balanced construction and pigeonhole lower bound for 3..64 players, redundancy 1..2 | adds a hop and relay-failure exposure; not a universal win |
| 30-player r=1 relay frontier | 29 direct fan-out → 5 relays / max sender fan-out 5 with 29 total transmissions | no one-relay-path failure tolerance |
| 30-player r=2 relay frontier | 7 relays / max sender fan-out 7 / 51 transmissions | one relay-path failure tolerant, but more aggregate traffic |
| redundant relays require domain diversity | relay-domain counterexample | two peer relays on one failed transport/power domain are not one-domain tolerant |
| relay cannot weaken Canon | relay planner rejects irreversible/total-order/crash-survival operations | Canon/authority remains on its strong path |
| Semantic Frontier composition | presence policy, Canon Nucleus and PBFT escalation are checked as separate guarantee domains | Byzantine Canon is not relabeled as crash-safe Canon |
| universal strict dominance | explicitly false | lower bounds, CAP and FLP remain hard boundaries |

## What is now saturated inside the crash-only model

Within the declared non-Byzantine model, the remaining obvious protocol questions are no longer hidden behind an atomic "replicate and migrate" assumption. Storage-before-ACK, visibility, follower loss, leader loss, partial dissemination, generalized crash majorities, uncertain completion, stale epochs, membership rotation, correlated failure-domain placement and dense presence fan-out each have either a positive proof or a retained counterexample.

That does **not** mean the real multiplayer system is certified. It means further progress on the same claims now needs evidence about quantities the deterministic model deliberately does not invent, such as browser scheduling, real RTT/loss bursts, SCTP behavior, ICE/TURN paths, radio suspension, CPU/frame cost and device/network failure correlation.

## Theory that remains intentionally outside the crash-only proof

### Malicious / Byzantine participants

Canon Nucleus assumes protocol-following peers that may crash. A peer that lies about durable storage, fabricates ACKs, signs conflicting histories, colludes or creates Sybil identities changes the failure model. Semantic Frontier must escalate such an operation to a Byzantine policy. The current project does not claim that three crash-only nucleus members solve anti-cheat or Byzantine consensus.

### Arbitrary bulk reconfiguration

Only one-member nucleus rotation through a common-majority bridge is certified here. Arbitrary old/new membership changes need sequential replacements or a joint-consensus state machine. The one-member theorem must not be extrapolated to a disjoint replacement set.

### Guaranteed strong progress under permanent partition

Strong Canon deliberately sacrifices availability without quorum. CAP/FLP boundaries remain part of the design, not defects to hide with shorter timers.

### Universal presence optimum

The adaptive relay proof reaches the exact max-sender-fan-out lower bound for its fixed two-level balanced relay model. It does not prove that two-level relaying is globally optimal among every multicast tree, SFU, network-coding, congestion-control or future transport architecture. Semantic Frontier remains open to registering a better policy without discarding its Pareto point.

## Transition to physical evidence

A theory claim may move to physical validation only when its logical boundary is already explicit. Physical tests can then answer questions such as:

- how much RTT the extra relay hop actually adds;
- whether a Pixel-Fold-class peer can relay the predicted fan-out without frame or queue regressions;
- whether browser backgrounding is detected early enough to rotate authority before the platform suspends execution;
- whether real burst loss/retransmission matches the model's eventual-delivery assumption;
- whether candidate failure domains thought to be independent actually share Wi-Fi, power or carrier dependencies.

A fast physical run cannot rescue a failed safety proof, and a passing deterministic proof cannot certify physical performance. Both evidence classes stay separate in `RRP_PERFORMANCE_CONTRACT.md`.

## Commands

```sh
node --test apps/rinne/tests/reality-canon-nucleus.test.mjs apps/rinne/tests/reality-semantic-frontier.test.mjs apps/rinne/tests/reality-theory-verification.test.mjs
node apps/rinne/scripts/reality-architecture-proof.mjs
```

A combined pass must still retain the old dense-Cell counterexample, impossibility boundaries and model/physical evidence separation.
