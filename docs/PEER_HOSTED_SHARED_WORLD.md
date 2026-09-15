# Peer-hosted Shared World / Darkness Host Migration

## Rinne DEV cooperative play acceptance

Rinne's current rebuilt game must expose an explicit private friend-play entry connected to its actual renderer, life progression and shared frontier. The standalone text-only online panel is not proof of playable multiplayer. This opt-in entry is separate from MURAAAAAAA's exterior-only sightseeing invitation and must not expand sightseeing permissions.

- Keep the shared-room limit at 30 participants; measure support rather than claim 30-device certification.
- The room Host processes bounded player intentions and advances one common world clock. Guests display the resulting state; a shared enemy must not lose HP in independent copies of a fight.
- Invitations and replies use the existing WebRTC transport. Provide a shareable invitation URL and a usable manual answer fallback; no new paid infrastructure is required for this DEV slice.
- Host loss or suspension stops guest progression and displays darkness. Do not promote a client through unverified majority claims; same-Host reconnect must recover from the room's accepted state.
- Use a separate cooperative save namespace. Joining, leaving and testing cannot replace a player's existing `life-v2` single-player save.
- This first DEV slice trusts its invited Host. It is not cloud-verified irreversible history, arbitrary-host cheat resistance, automatic distributed migration, or physical Pixel Fold/NAT/TURN certification. These remain explicit RRP gates.


## Current application contract

The latest `docs/VILLAGE_VISUAL_AND_FRIEND_INVITE.md` governs the application entry points. Village owners deliberately issue a 15-minute friend invitation. The dedicated guest page receives exterior presentation only: no people, progression, room contents, personal save, raid state or rewards. Demon keeps its disabled `friend-invite-only` online adapter. There is no public village directory or ordinary online-raid entry.

`@soul/network/friend-visit-authority` connects the real friend invitation flow to the shared peer-hosted authority implementation. The existing WebRTC offer/answer and the single active invitation remain unchanged. A `friend-village` message contains the existing exterior snapshot plus bounded authority metadata; subsequent `friend-world` frames carry only authority and heartbeat control. The adapter rejects checkpoint and migration-grant frames and validates invitation world, peer identity, host identity and visitor ineligibility.

The owner remains the only eligible simulation host. The visitor acknowledges the host lease with `hostEligible: false`. After host loss the guest becomes closed and the shared darkness overlay blocks view controls. The owner's local village and personal saves continue independently: a sightseeing visitor never controls the owner's simulation or persistence.

**The current appearance-only friend visitor cannot take over a village.** Full simulation migration is supported and tested for explicitly eligible peers by the shared network runtime, but no current friend UI grants that capability. In the current one-guest star, no guest-to-guest mesh edge exists to form. Mesh signalling and promotion retention are exercised with eligible peers in the network browser verification below.

## Shared authority and migration runtime

Peer-hosted failover works without replacing existing game runtimes with mandatory dedicated servers. It does not require an ECS rewrite. Gameplay and simulation rules remain with their app owners.

`createPeerHostedWorldNode` tracks world/host/mayor IDs, epoch, revision, open/migrating/closed phase, bounded host lease, deterministic member order, host eligibility, checkpoint revision and migration proof. Plain authority messages cannot advance an epoch. An eligible host can reopen only after a graceful grant or a majority-quorum migration proof.

- Three eligible peers: after A fails, B+C can form a majority and choose a successor.
- Two eligible peers, sudden partition: neither side may continue authoritative progression.
- Two eligible peers, explicit graceful handoff: the successor restores a validated checkpoint before reopening.
- Ineligible peers can acknowledge/vote but are never elected.
- A returning old host must synchronize from the accepted newer migration proof.

Heartbeat intervals derive from the configured lease; shortened deterministic test leases also retain multiple heartbeat opportunities within one lease.

`createPeerMeshCoordinator` uses lower stable peer ID to initiate each link. Control, authority, checkpoints and migration proof use reliable ordered delivery; replaceable presence uses the unordered zero-retransmission lane. Existing mesh edges survive promotion, and transient `disconnected` does not eject a peer before terminal failure or lease expiry.

## Checkpoints and personal persistence

The generic checkpoint schema keeps bounded world state, time/RNG, entity positions and optional bounded session data. Eligible simulation hosts restore it in memory before reopening. Generic `RaidHost` checkpoint support remains a library capability and is not exposed by the current non-hostile friend entry.

Personal `living-v5` persistence retains the current incremental journal, first-run detection, ordered writes, retries and recoverable backup semantics. The peer read-only guard prevents writes and recovery in a remote authority context, including a save queued before authority is lost. The friend guest has no personal-save adapter at all; it never imports a remote world into an owner's local save.

## Verification

Focused tests preserve election, three-peer recovery, two-peer fail-closed behavior, graceful grants, stale epoch rejection, old-host recovery, mesh retention, checkpoint restoration and personal-save read-only protection. Friend-path tests additionally verify invite expiry, non-hostile role filtering, exterior-only privacy, visitor ineligibility and closed viewing after a partition.

`npm run world:host-chaos` exercises a deterministic delayed/lossy host-loss replay.

The normal PR browser gate executes two distinct real-WebRTC checks:

1. Actual Village friend UI: owner issues the invitation, visitor returns an answer, exterior viewing opens, and owner loss closes viewing with darkness. This is the currently shipped application behavior.
2. Three independent Chromium contexts load the exact shared network module sources. Native WebRTC DataChannels preform a direct peer mesh, A crashes, B+C recover via quorum and checkpoint, then B gracefully grants C the next epoch. No transport mock is used. This verifies the eligible-peer library capability, not a claim that current sightseeing guests own simulation.

Neither test is physical multi-device certification. Browser assertions remain asynchronous Integration gates and are not replaced by local numeric tests.

## Dependency and delivery

Depends-On: #236. The repaired branch merges forward the dependency and current develop while retaining the current friend invitation/privacy contracts. Main / Production remain untouched. Ready exact-head checks and the existing single Fast Lane own develop integration and DEV publication.
