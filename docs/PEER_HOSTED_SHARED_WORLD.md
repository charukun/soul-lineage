# Peer-hosted Shared World / Darkness Host Migration

## Goal

The shared world stays peer-hosted. Host ownership is allowed to move between eligible MURAAAAAAA peers and that technical migration is represented in-world as darkness covering the village until a safe checkpoint is restored.

This design deliberately does **not** make a dedicated server mandatory and does **not** require an ECS rewrite. Performance-oriented data layouts may still be introduced locally when measurement justifies them, but they are not an authority prerequisite.

## Runtime roles

### MURAAAAAAA peer

A MURAAAAAAA peer owns the full village `World` / `Simulation` runtime and is therefore `hostEligible: true`.

- The initial village owner starts as Host.
- A second MURAAAAAAA device may join as a standby Host candidate.
- Standby candidates participate in quorum but are represented as `standby` in `RaidHost`; they never become phantom human combatants.
- A standby stores checkpoints without applying them to its personal local village.
- Only when it wins a migration does it restore the shared checkpoint into memory and resume authority.
- Remote/shared authority is read-only against the device's personal `living-v5` save. Losing Host authority also makes local persistence read-only until that peer owns the open world again.

### 輪廻転焦 / 尽喰廻遊 peer

These applications participate in the peer mesh, checkpoint replication and quorum voting but are currently `hostEligible: false` because they do not embed the complete MURAAAAAAA village simulation runtime.

They follow the current Host automatically after migration and continue to send presence over the new peer connection. They do not pretend to become a village Host.

## Authority state

The shared `@soul/network/peer-hosted-world` runtime owns only migration metadata:

- `worldId`
- `hostId`
- `mayorId`
- `epoch`
- `revision`
- `open / migrating / closed`
- deterministic member join order and host eligibility
- bounded Host lease
- latest validated checkpoint revision
- last migration proof

Gameplay rules, combat/damage rules and the village simulation remain with their existing owners.

A plain `world-authority` message cannot advance `epoch`. A higher epoch becomes authoritative only through a validated `world-migration-open` carrying either:

1. an explicit graceful Host grant, or
2. a majority-quorum migration proof from the previous connected cohort.

This prevents an arbitrary peer from claiming a newer epoch through an ordinary state message.

## Quorum lease and split-brain safety

The Host does not renew its lease merely because its own timer is running. It sends heartbeat messages and renews the lease only after receiving a majority of acknowledgements from the last connected cohort.

Consequences:

- 3 peers: if Host A disappears, B + C form the majority and one eligible peer can reopen the world.
- 4 peers: Host needs a majority of the four-member cohort; a minority partition cannot continue authority.
- 2 peers, sudden partition: neither side has a majority, so both remain in darkness rather than creating two worlds.
- 2 peers, graceful handoff: the current Host can explicitly grant authority to the other eligible peer before leaving, so normal planned handoff still works.

Fail-closed darkness is preferable to split-brain world progression.

## Preformed WebRTC mesh

The original Host remains the initial manual signalling relay only while it is alive.

After peers join, eligible/session peers preform direct WebRTC links with each other. The lower stable peer ID deterministically initiates each mesh edge to avoid double offers.

Each direct edge keeps the existing two-lane transport:

- reliable / ordered: authority, checkpoint, migration proof, join/battle control
- unordered / `maxRetransmits: 0`: replaceable presence/state

When a former client becomes Host, its already-established mesh edge is retained and becomes the new Host transport. `syncMembers()` may skip creating a duplicate edge to the current star Host, but it never closes an already-established edge merely because that peer was promoted.

Transient WebRTC `disconnected` states are not treated as terminal. `failed`, `closed` or explicit send failure can remove an edge; ordinary radio/network wobble is left to the lease/quorum timer.

## Checkpoint contents

`createVillageCheckpoint()` remains bounded and validated. The checkpoint now may include a `session` payload in addition to the village world, NPC/character positions, random state and world time.

MURAAAAAAA stores `RaidHost.checkpoint()` inside that session. It contains:

- online peer state
- demon visit ledger
- current HP/position state
- compact battle envelope

On migration an unfinished Tidebreak battle is reconstructed using the same village/player seed and the checkpointed HP/positions. The exact animation/action sub-frame is intentionally not serialized. The darkness interval is the safe boundary where combat presentation can settle into a new stance without duplicating damage events.

## Darkness experience

`@soul/shared-ui/world-darkness` is the common presentation layer.

- `open`: 「闇が晴れていく」
- `migrating`: 「闇が村へ迫っている」
- `closed`: 「村は闇に閉ざされている」

During `migrating` / `closed`, the overlay blocks interaction. MURAAAAAAA pauses authority simulation; 尽喰廻遊 pauses `RaidSession.tick`. Rendering may continue underneath so the transition is a world event rather than a loading screen.

After a valid checkpoint is restored and `world-migration-open` is accepted, the overlay clears and gameplay resumes.

## Returning old Host

A peer that returns after a partition cannot simply publish its stale state.

If it sees a heartbeat from a valid Host with a newer epoch, or the same epoch while its local state is still `migrating`, it requests synchronization. The new Host resends the stored migration proof. The returning peer validates that proof before adopting the new Host.

## Existing rehearsal

`apps/rinne/src/village-link.js?villageHostLab=...` remains an opt-in same-browser BroadcastChannel rehearsal/diagnostic. It is not the production cross-device authority route.

The formal route is the WebRTC peer mesh implemented in `@soul/network` and consumed by the three game applications.

## Verification

Focused automated coverage includes:

- deterministic candidate election
- 3-peer sudden Host loss and quorum recovery
- 2-peer sudden partition fail-closed behavior
- 2-peer graceful handoff
- non-host-eligible peer voting without election
- stale/higher epoch rejection without migration proof
- returning old Host resynchronization
- mesh offer/answer determinism
- established mesh edge retention after Host promotion
- RaidHost checkpoint/restore
- standby candidate exclusion from combat
- personal local-save read-only guard during remote/non-authority operation
- shared darkness/pause wiring across all three apps

`npm run world:host-chaos` runs a deterministic delayed/lossy Host-loss/recovery replay and emits a machine-readable report.

## Dependency and deployment boundary

This phase consumes PR #236 and should integrate after `#203 → #220 → #226 → #229 → #236`.

`main` / Production are not changed by the implementation session. Ready exact-head fast/browser validation, Integration, DEV publication and real multi-device browser evidence remain on the normal repository handoff path.
