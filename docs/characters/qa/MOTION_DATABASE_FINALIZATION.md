# Motion Database Finalization

This work takes the shared motion-quality / orchestration stack from advisory diagnostics into a production-facing motion database, transition, interaction and contact presentation layer while preserving gameplay authority and the existing Motion QA visual-approval boundary.

## Implemented shared source of truth

`@soul/animations` remains authoritative for portable motion contracts and `@soul/rendering/motion-runtime` remains a thin re-export adapter.

### Motion feature database

`motion-database.js` adds a deterministic indexed feature database on top of the existing pose-candidate bank.

Each sampled record can carry:

- clip / frame / normalized phase
- state and support side
- speed band and facing
- predictive trajectory
- continuity
- semantic events
- optional root / center-of-mass / weapon-tip features
- declared transition compatibility

Buckets index state/support/speed, transition keys and semantic events so runtime queries do not need to treat the clip list as an undifferentiated array.

The database is advisory and explicitly has no gameplay or contact-timing authority.

### Transition application

The runtime now plans presentation transitions across idle, move, stop, pivot, attack, recovery and hit states.

- locomotion-family transitions may phase-align once when the committed transition is entered
- continuous `move -> move` frames do not repeatedly reset locomotion phase
- attack-related transitions never phase-align the authored action clock
- locomotion-to-attack, attack-to-recovery and hit-to-recovery use a bounded additive torso/pelvis bridge
- the bridge is applied after the existing ground/contact solve but before downstream weapon/socket sampling
- non-commit swept contact samples never advance transition history

Shino slash remains 0.66 seconds with the existing gameplay contact phase/timing.

## Explicit interaction adoption

The Interaction Schema library still requires an explicit partner and explicit anchors.

The first real game adoption is 尽喰廻遊 devour presentation. `packages/raid/devour.js` already owns the authoritative capture lifetime through `npc.capturedBy`. `apps/demon/src/motion-interactions.js` consumes that existing explicit state as `eat-target` presentation metadata and applies a bounded MasterCharacter root pull/facing correction only while capture is active.

It does not mutate NPC/player world coordinates, devour progress, reward, `eaten`, combat or save state.

Village `carry` remains furniture transport and is deliberately not mapped to `carry-child`. No village social/parent interaction is inferred until gameplay provides an explicit partner/anchor contract.

## Weapon contact

`motion-contact.js` adds a segment-against-capsule sweep over previous/current weapon base/tip samples. It reports measured penetration, time-of-impact, contact point/normal and relative weapon speed as presentation evidence.

Rinne uses this only after an existing authoritative Impact Beat has already identified both actor and target. No independent target search or second damage event is introduced. The measured geometry can refine the existing visual deflection/recoil, while `damageAuthority` and `collisionAuthority` remain false.

## Surface-aware foot contact

A shared surface-foot-plant contract maps `unknown`, `grass`, `dirt`, `stone`, `wood`, `mud`, `water` and `snow` into presentation audio/VFX/decal cues.

Rinne emits the contract when the final foot-lock state changes from unplanted to planted. It consumes `api.terrain` / `__RINNE_TERRAIN_SAMPLE__` when a runtime environment provides one. If no material-aware sampler exists, the event stays `unknown`; this work does not invent terrain material identity.

The contract never changes navigation friction, collision or authoritative movement.

## Crowd desired velocity

The shared personal-space system now exposes a bounded `desiredVelocity` that combines preferred velocity with the personal-space suggestion and an explicit max speed.

Village and Demon expose that value in their motion-crowd diagnostics and continue applying only the existing bounded render-node bias. `appliedToWorld:false` and `navigationConsumerRequired:true` are retained.

This deliberately does **not** mutate current authoritative AI/navigation coordinates. A future simulation/navigation owner can explicitly consume the same desired velocity without moving presentation logic into world authority.

## Physical-device calibration and Motion LOD

Measured motion timing can now be converted into a presentation LOD recommendation/application only when calibration evidence has `measuredHardware:true`, which itself requires explicit physical-device assertion, user agent, non-zero sample count and measured total timing.

Design targets such as `pixel-fold-class-30` / 5.5 ms are never treated as physical measurements.

Calibrated LOD may reduce presentation update rates for pose-search, terrain IK, gaze, fingers and secondary motion. It may not reduce contact sampling, damage or network rates.

The current session did not perform a physical Pixel Fold benchmark. The runtime/QA evidence path is ready for device QA to call explicitly.

## Bounded autonomous repair proposal

`motion-repair.js` adds a fail-closed parameter-repair contract for a small allowlist of deterministic diagnostics:

- foot slide
- motion jerk
- device presentation budget
- trajectory jitter
- support balance

A proposal can only touch bounded presentation parameters. It cannot edit gameplay state or contact timing and cannot grant visual approval.

A Draft repair dispatch is emitted only after comparable deterministic recapture evidence shows objective improvement. Artistic/frame regressions outside the allowlist remain human-review tasks. Parameter values are canonicalized so identical evidence produces stable repair requests.

This is an entry point for the existing Dispatcher/Rescue workflow, not permission for the browser runtime to rewrite source or merge code by itself.

## QA and review

Existing Foot Sliding, Jerk, COM/support, collision, perceptual, frame and Character Motion QA remain active. Character Workshop continues to expose motion debug evidence without inventing unavailable gameplay data.

Numeric checks, browser captures and repair proposals never replace observed 1x review. `visualApprovalRequired` remains true where required by the existing QA contract.

## Explicit limits

This work does not claim any of the following:

- no new DCC-authored production animation clips were created; the database indexes and selects the existing authored/shared clips
- no physical Pixel Fold measurement was taken in this implementation session
- Rinne does not claim stone/grass/etc. surface identity when no material-aware terrain sampler is supplied
- Village/Demon authoritative navigation does not yet consume crowd desired velocity automatically
- no real physics backend exists, so Active Ragdoll remains a fail-closed bridge
- no automatic visual approval is introduced

## Authority invariants

- actor world transform, damage, collision/contact authority, save state and multiplayer/network authority remain outside the presentation motion runtime
- Shino authored slash remains 0.66 seconds and retains its gameplay contact clock
- Motion Warp keeps target snapshot / no-homing / bounded contact-stop behavior
- non-commit swept samples never advance presentation transition state or choose a gameplay action
- main / Production and the independent Visual Review Lab branch are unchanged

## Delivery

This is a normal implementation task on `feat/motion-database-finalization` / PR #260. It finishes as Ready for review with `READY_FOR_INTEGRATION`; Integration owns asynchronous exact-head CI, merge and DEV publication.