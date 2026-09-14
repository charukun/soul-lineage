# Motion Database Finalization

This work takes the existing shared motion-quality / orchestration stack from advisory runtime diagnostics into a production-facing motion selection and interaction layer while preserving gameplay authority and the existing Motion QA visual-approval boundary.

## Acceptance scope

- keep `@soul/animations` as the portable source of truth and `@soul/rendering` as a thin presentation adapter
- carry forward the verified Motion Warp, mass response, life, interaction, orchestration, operational QA and Workshop diagnostics from the latest motion integration PR without weakening current develop control-plane changes
- add a deterministic motion database index containing locomotion/transition features, support side, semantic events, root/COM/weapon trajectory metadata and searchable candidate buckets
- expand Pose Search application from locomotion entry to safe presentation transitions: move→stop/pivot, stop→move, locomotion→attack anticipation, attack recovery→locomotion and hit→recovery, while preserving authored gameplay contact clocks
- connect explicit interaction schemas to real game actions only where the gameplay side provides a partner/anchor; never infer social/combat relationships from generic state
- derive presentation-only weapon contact constraints from real swept segment/contact evidence without creating a second damage/collision authority
- route semantic foot-plant evidence through a shared surface-contact contract for footstep/VFX/material presentation without changing navigation physics
- expose crowd personal-space steering as a bounded desired-velocity suggestion while preserving authoritative AI/save/combat ownership
- make physical-device motion calibration evidence consumable by Motion LOD without treating design budgets as measured hardware
- extend the existing review planner with bounded repair proposals that may create a Draft repair request only after deterministic recapture evidence; never auto-approve visual quality

## Invariants

- Shino authored slash remains 0.66 seconds and keeps the existing gameplay contact phase/timing
- actor world transform, damage, collision/contact authority, save state and multiplayer/network authority remain outside the presentation motion runtime
- non-commit swept samples never advance presentation history or select a different gameplay action
- numerical QA and automated repair proposals do not replace observed 1x review or explicit human visual approval
- no fake physics backend is introduced; ragdoll remains fail closed unless a real physics adapter exists
- main / Production and the independent Visual Review Lab branch are not changed by this work

## Delivery

This is a normal implementation task. The branch starts from current develop, stays Draft during implementation, runs focused affected validation, then ends at Ready for review with `READY_FOR_INTEGRATION`. Integration owns asynchronous CI, merge and DEV publication.