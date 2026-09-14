# Motion Selection Final Pass

This pass carries the verified PR #222 motion stack onto latest develop and extends it from correction/interaction into orchestration, semantic events, predictive presentation, candidate ranking, reusable interaction semantics and review tooling without moving gameplay authority into animation.

## Implemented shared contracts

`@soul/animations` now owns:

- an explicit layer dependency/ownership graph: source pose → body adaptation → personality → condition → locomotion intent → interaction → ground contact → weapon sockets → secondary → QA
- fail-closed validation for dependency cycles, missing dependencies, duplicate exclusive writers and forbidden presentation ownership of world transform, damage, contact authority, network authority or save state
- semantic events: `foot-plant`, `weight-transfer`, `anticipation-end`, `weapon-release`, `contact`, `follow-through`, `handoff`; semantic `contact` is descriptive and `contactAuthority` remains gameplay-external
- bounded future-trajectory prediction, maximum 0.75 seconds, used as advisory/presentation data only
- Pose Search Lite ranking existing candidates by trajectory, speed, facing, support side, state and continuity; no ML model, asset download or automatic gameplay attack selection
- stable character-seeded variation for start foot, idle/gait phase, stance, turn and recovery amplitude with `contactTimingScale: 1`
- explicit Interaction Schemas for talk-close, handshake, hug, carry-child, grab, blade-clash, eat-target and grapple; every schema requires an explicit partner and anchors and never infers a relationship from generic game state
- bounded weapon-contact visual deflection/recoil with no damage authority
- a ragdoll blend bridge that stays in animation when no physics adapter exists; no fake physics backend is fabricated
- advisory personal-space steering with `worldAuthority: false`
- per-layer presentation profiling and LOD recommendation contracts that can never disable gameplay/contact/network authority
- an autonomous review planner that combines existing frame, perception/trajectory, support/COM, collision, semantic-contact and issue evidence, but has `autoEditAllowed: false`, `autoApproveAllowed: false` and always requires visual approval
- diagnostic overlay data for COM, supports, future trajectory, interaction, hit direction, foot locks and semantic events

`@soul/rendering/motion-runtime` remains a thin re-export adapter; apps do not import one another.

## Rinne live consumer

`HumanoidRuntime` now ends in `humanoid-selection.js` after the existing natural stance → dynamics → life → interaction layers.

- Predictive Locomotion uses current velocity plus explicit `_motionIntent` when available and applies only a small bounded hips/head lead before the existing ground/foot-lock solve. Actor x/z/yaw are never written by this layer.
- Shino semantic timing is derived from the real `SLASH_SECONDS=.66` and existing slash timing/contact data. Commit-time semantic crossings can feed presentation channels, while damage/contact remain external.
- Pose Search Lite is evaluated only when gameplay supplies `_motionPoseCandidates`; the result is exposed as `poseSuggestion` and is not executed as an attack/movement choice.
- Interaction Schema diagnostics require explicit `_motionInteraction.schema`, partner and anchors. The existing interaction layer remains the visual anchor solver.
- An authoritative Impact Beat with an identifiable attacker creates a short-lived visual weapon-contact deflection for that attacker. The effect expires after about 0.14 seconds and never adds a damage/contact event.
- Stable variation affects presentation only and never alters contact timing.
- Runtime profiling records `base-motion`, `selection` and `weapon-contact` separately. The `pixel-fold-class-30` 5.5 ms value is a design budget, not a physical Pixel Fold measurement; `measuredHardware` stays false until real-device evidence exists.

## Character Workshop Motion Debug

`characters.html` loads `character-motion-debug.js`. During Motion QA only, it overlays actual model-derived center of mass and left/right foot support plus current semantic slash events over the stage. It reconstructs the QA camera from the existing fixed camera snapshot and uses actual humanoid bone world positions.

Workshop does not invent future gameplay intent, interaction partners or hit direction. Those fields remain visibly unavailable until real gameplay input is supplied. Normal editing keeps the overlay hidden.

## Three-app and multiplayer boundary

The shared motion runtime inherited from PR #222 remains active for MURAAAAAAA residents and 尽喰廻遊 human NPCs through their existing MasterCharacter presentation boundaries. The new predictive/Pose Search layer is not silently connected to their AI/navigation: the portable functions are available, but gameplay must explicitly supply intent/candidates before use.

Motion sync/reconciliation, Motion Warp target locking, swept weapon sampling, damage/contact, save state and multiplayer/network authority remain unchanged.

## Active Ragdoll boundary

No Rapier/Cannon/Ammo/Havok-style physics backend is present in the current repository. This pass therefore adds a real adapter boundary only: a ragdoll request fails closed to normal animation with `physics-adapter-unavailable` until an actual physics implementation is introduced. It does not simulate fake ragdoll behavior with arbitrary bone noise.

## QA and delivery

Focused remote-exact shared tests cover orchestration/selection and review planning. Rinne parity/authority tests cover semantic slash timing, future trajectory, Pose Search Lite, variation, explicit schemas and contact constraints; source regressions additionally protect semantic presentation channels, impact-derived deflection expiry, profiler authority and Workshop overlay wiring.

These tests and overlays remain diagnostics. They cannot grant visual approval. Normal-speed human review, actual WebGL browser verification and physical device performance evidence remain separate gates.

Main / Production and the independent Visual Review Lab branch are unchanged. Once the latest-develop PR for this pass becomes Ready, it supersedes PR #222 so only one Integration candidate remains.
