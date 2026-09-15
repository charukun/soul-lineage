# Shared motion adoption acceptance

Lab remains `work/visual-review-lab-v2` / Draft #23; this separate develop PR adopts only compared motion changes and required shared adapters. Start source: `8347b031188587922711eb69dec61eb5eb84c088`; develop base: `3675393254b1056193a1ff1e5be9e0fe1867c899`.

- Preserve latest split `humanoid-core` / `humanoid-natural-stance`, existing input, collision, damage and hit clocks.
- Trace Rinne runtime, village MasterCharacter residents, demon human NPCs through canonical sources; no app-to-app source imports or new motion fork.
- Humanoid sword poses must not override monster/reaper rigs, role props, child weapon restrictions, hit/death/consume state, or village work gestures.
- Validate each connection and selective asset/build delivery before Ready. Lab render success is not game success.
- Record exact adopted Lab SHA, revision, per-app tests, known limits and DEV evidence. No wholesale #23 merge, force push, Production or protection/hold changes.

## Initial inspection

Rinne uses `apps/rinne/public/simulator/src/humanoid.js` -> core + natural stance. Village `mura-master-characters.js` and demon `master-humans.js` currently animate their MasterCharacter raw rigs using local procedural pose functions, not the Lab sword/locomotion source. Connecting those consumers requires an explicit shared runtime/retarget adapter and per-state tests; merely copying Lab modules cannot deliver three-app motion parity.

Status: Draft; connection and validation pending. This is not READY_FOR_INTEGRATION or DEV_DEPLOYED.
