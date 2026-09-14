# Peer-hosted Shared World / Darkness Host Migration

## Goal

Promote the existing village host-migration rehearsal into the shared-world authority path used across separate WebRTC peers without replacing the project's peer-hosted design with mandatory dedicated servers or an ECS rewrite.

## Acceptance for this phase

- Keep one elected peer as the active world host under a bounded lease/epoch contract.
- Replicate validated checkpoints so an eligible peer can take over when the host disappears.
- Enter a paused `migrating` phase during ownership transfer and drive the existing darkness veil from that authoritative migration state.
- Restore the latest accepted checkpoint before reopening the world.
- Reject stale epochs, stale checkpoints and split-brain host claims.
- Preserve the existing reliable control lane and lossy presence lane.
- Keep gameplay/combat/save authority in the existing game/domain owners; migration transports authority state but does not redesign those rules.
- Provide a deterministic multi-peer chaos harness for host disconnect, delayed/lost replaceable presence, reconnect and migration timeout.
- Keep `main` / Production unchanged. Full remote-device/browser verification remains an Integration/diagnostic responsibility.

## Dependency

This phase consumes the realtime transport and scalable simulation contracts from PR #236 and should integrate after it.
