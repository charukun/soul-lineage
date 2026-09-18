# Semantic multiplayer persistence foundation

This is the production-facing boundary left behind after the Semantic Kernel / RRP comparison work. It is intentionally small and uses known event-sourcing mechanics. It does not add a new consensus protocol.

## Runtime authority

- Existing `coop-v2` remains gameplay authority.
- The new semantic persistence path is non-authoritative until a later multiplayer migration explicitly promotes it.
- A semantic persistence failure must not turn a successful `coop-v2` save into gameplay failure.
- No change is made to combat, rebirth probability, movement, Host authority, WebRTC transport, main, or Production.

## Protected semantic journal

Only irreversible facts are journaled:

- player birth;
- life seal;
- rebirth from a sealed predecessor;
- authority epoch acquisition.

Terminal life inputs such as equipment, experiences, skills, defeats and homelands are protected through the life-seal payload. Position, movement, transient HP/stamina and presentation remain provisional.

The local adapter persists an append-only journal with deterministic event identity and the current protected projection. It is a migration-ready adapter, not a claim of cloud durability or hostile-Host safety.

## Provisional checkpoint

A separate whole-state checkpoint is retained on an RPO cadence. It is recovery material, not semantic truth. Recovery combines the newest provisional checkpoint with the protected semantic projection so that provisional state may roll back while sealed/reborn lineage facts do not.

The initial local RPO is 2 seconds. Future server/database adapters may use another transport or transaction mechanism behind the same boundary.

## Compatibility

Existing `coop-shadow-v1` state is accepted as a one-way migration source when reopening an older village. New sessions persist the semantic foundation under the new store and do not depend on the legacy diagnostic key.

## Acceptance

- Normal coop gameplay and `coop-v2` authority behavior are unchanged.
- The first successful authority save establishes a semantic bootstrap and provisional checkpoint.
- Protected events append once with deterministic IDs.
- Ordinary movement does not enter the semantic journal.
- Provisional checkpoints refresh independently on the configured RPO.
- A stale provisional checkpoint can be overlaid with the protected projection for future recovery.
- Semantic persistence corruption/failure is surfaced diagnostically and does not fail a successful authoritative save.
- Focused coop/history/semantic tests pass.

Depends-On: none
