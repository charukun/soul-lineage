# RRP convergence sources and inherited boundaries

Consulted or rechecked 2026-09-18. These sources establish prior art and repository facts. They do not turn the finite JavaScript model into a proof of the production game.

## P1. RedBlue Consistency

Cheng Li, Daniel Porto, Allen Clement, Johannes Gehrke, Nuno Preguiça and Rodrigo Rodrigues, *Making Geo-Replicated Systems Fast as Possible, Consistent when Necessary*, OSDI 2012.

Primary USENIX page: https://www.usenix.org/conference/osdi12/technical-sessions/presentation/li

The paper explicitly separates operations that can remain fast/eventually consistent from operations that must be strongly consistent and gives conditions for the classification. Rinne's semantic split is therefore not named as a new consistency class here.

## P2. Invariant confluence / coordination avoidance

Peter Bailis, Alan Fekete, Michael J. Franklin, Ali Ghodsi, Joseph M. Hellerstein and Ion Stoica, *Coordination Avoidance in Database Systems*, PVLDB 8(3), 2014.

Primary PVLDB PDF: https://www.vldb.org/pvldb/vol8/p185-bailis.pdf

I-confluence provides an application-invariant criterion for when coordination is necessary. The convergence candidate does not claim a more general theorem. Its per-effect classification must eventually be refined against the actual Rinne transition/effect language.

## P3. Raft

Diego Ongaro and John Ousterhout, *In Search of an Understandable Consensus Algorithm (Extended Version)*.

Primary paper: https://raft.github.io/raft.pdf

Raft is a baseline for replicated logs, majority commit, recovery and membership changes. A semantic event journal replicated by Raft/Paxos-class machinery is a fair baseline and can match the convergence candidate's strong-path communication when given the same event representation.

## P4. CALM / logic and lattices

Neil Conway, William Marczak, Peter Alvaro, Joseph M. Hellerstein and David Maier, *Logic and Lattices for Distributed Programming*, UC Berkeley EECS-2012-167.

Primary report page: https://www2.eecs.berkeley.edu/Pubs/TechRpts/2012/EECS-2012-167.html

CALM/monotonicity theory is prior art for identifying computations that need not coordinate. The current Rinne candidate does not infer arbitrary monotonicity from JavaScript.

## P5. Event Sourcing

Martin Fowler, *Event Sourcing* (2005, explicitly a draft architectural article).

Original article: https://martinfowler.com/eaaDev/EventSourcing.html

The article describes application state reconstructed from an event sequence and snapshots taken in parallel. It is software-architecture prior art, not a peer-reviewed consensus theorem. The Rinne journal+snapshot candidate is intentionally described as an application of this known pattern.

## Repository source observations at task start

Start develop: `d23c28671a221a5fc39f81c56af99ea32e6e5beb`.

- `apps/rinne/src/coop/history.js` blob `aaba57a8454575646d69aadd48b73127a1972c29`: structural born / life-ended / reborn history, lineage monotonicity and rebirth idempotency; comment explicitly says host-attested progress is not proof of honest gameplay.
- `apps/rinne/src/coop/history-store.js` blob `8e8aba8c8f3a7de1332488faeb424ed14337558b`: local `coop-v2` checkpoint+history envelope, epoch fencing, `writeId` + intent hash, whole-checkpoint persistence, `cloud:false`, `authenticatedAuthority:false`.
- `apps/rinne/src/coop/checkpoint-writer.js` blob `10fea20829a8388ea596171a6730d039661f0941`: one in-flight + one coalesced save, actor-scoped pending visibility and committed projection.
- `apps/rinne/src/coop/session.js` blob `7cbb1cc96851e50e2450bd436e2930fb9d6aae48`: 20 Hz host advance, periodic persistence, rebirth persist-before-ack and stale-epoch rejection.
- `apps/rinne/src/rebuild/coop-world.js` blob `11a4d1c114e2ffc2a7d3c446cd3c6ce315dcd5ec`: 30-player host-authoritative simulation; `dirtyHistory` on participant birth, life end and rebirth; full-world save.
- `apps/rinne/src/rebuild/domain.js` blob `90dc1fd32cbabfef20b8e28286b02baccdcea9b8`: life/rebirth/lineage dependencies. `returnHome` changes `homelands`; `lineageRecord` consumes return/defeat/equipment/experience/skills. `endLifeEarly` exists, while current co-op history's structural end rule is lifespan-based. Reachability of an early-end checkpoint through current co-op is not asserted here.
- `apps/rinne/docs/FRIEND_PLAY.md` blob `18563cc8e2ef1d0b03dc4d1ab18189e7e6a260f3`: current product contract trusts the host, permits rollback of recent unsaved gameplay state, and does not claim cloud canon, hostile-host safety or automatic host migration.
- `apps/rinne/docs/CANON_NUCLEUS.md` blob `05f2cc0d59fd0b5bd85b3a59259f8fd08865abc0` and `src/game/reality-lab/canon-nucleus.js` blob `75c9b26afd1243a14f43e0b794da97cafc551085`: existing research already separates realtime/recovery/canon/authority but places canon plus recovery material in each modeled strong commit.
- `apps/rinne/src/game/reality-lab/performance-contract.js` blob `5142d428dfb24418e94abf2bfe242086bfbc5706`: existing evidence classes, hard safety keys, physical sample floors, SLOs and ratchets. This convergence work reuses that measurement vocabulary instead of inventing a success threshold.
- `apps/rinne/tests/coop-history.test.mjs` blob `7f16db9bafb0ca140cccee2b99d7b63a7e2f6357`: current executable contracts for lost-ACK idempotency, epoch fencing, stale/resurrected history rejection, corruption fail-closed behavior, actor-scoped pending visibility and save coalescing. The convergence model does not claim those tests executed in this no-checkout workspace.

## Inherited theory

The already-merged RRP theory reports on compiler soundness, hyperproperties, replayability, information flow, randomness, provenance, temporal semantics, attestation and semantic evolution remain inherited constraints. This task composes them around the actual Rinne effect surface; it does not restate their proofs or assign new names to them.
