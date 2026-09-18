# Motion Runtime Operationalization

This pass turns the motion-selection/orchestration stack into game-facing presentation infrastructure while preserving gameplay, contact, save and network authority.

## Delivery base

The work started from `develop` and was resynced after the Integration control plane advanced. The final branch contains the newer Integration/Rescue/CI control plane as a merge parent and keeps its files unchanged. Earlier unmerged motion PRs were carried as verified source material, never used as the merge base.

## Pose Search Lite → locomotion entry

`@soul/animations` now builds a deterministic candidate bank from clip/state/duration/speed/support/continuity data and ranks candidates using trajectory, facing, support side, state and continuity.

Rinne builds candidates from the actual existing `idle-01`, `walk`, `run-slow`, slash and slash-recovery sources. On a committed `idle → walk/run` transition only, the winning walk/run entry phase seeds `_humanoidPhase`. Attack, recovery, death and non-commit swept samples cannot apply the selected phase. Actor x/z/yaw and attack/contact timing remain gameplay-owned.

## Semantic presentation events

Stable semantic names remain `foot-plant`, `weight-transfer`, `anticipation-end`, `weapon-release`, `contact`, `follow-through` and `handoff`. Shared presentation routing maps them to optional footstep/surface VFX, cloth/body FX, camera, weapon VFX, audio and transition consumers.

Rinne dispatches committed semantic events through `__RINNE_MOTION_EVENT_CHANNELS__` and a `rinne:motion-presentation` browser event. Semantic `contact` always carries `contactAuthority: gameplay-external`; it never creates damage or replaces the native gameplay contact clock.

## Explicit interaction adapter

The shared adapter and Rinne runtime require an explicit schema, partner and both anchors. Rinne exposes `setInteraction` / `clearInteraction`; generic actor state is never interpreted as a relationship. Existing schemas remain talk-close, handshake, hug, carry-child, grab, blade-clash, eat-target and grapple.

## Weapon contact

Shared swept-contact evidence records contact point, normal, relative speed, penetration, weapon mass and hit serial while declaring both damage and collision authority false.

Rinne chains the existing authoritative Impact Beat. Only when `actorId` and `targetId` resolve to real actors and the attacker has current `weaponBase` / `weaponTip` endpoints does it derive presentation evidence from that actual weapon segment. The small penetration term is explicitly marked estimated. No additional hit/damage event is created.

## Foot sliding and jerk QA

`motion-kinematics-qa.js` adds:

- world-space planted-foot windows with 2 cm warning and 5 cm fail-candidate defaults
- path distance and maximum displacement per planted window
- linear and angular jerk diagnostics for arbitrary tracks
- combined kinematics evidence with `visualApprovalRequired: true`

Rinne records actual Foot Lock state plus world-space left/right foot positions and recent hips/chest/head/limb/weapon-tip tracks on committed samples. The existing autonomous review planner now raises foot-slide, motion-jerk and measured-device-budget review tasks without granting approval.

Character Motion QA can attach kinematics and device-calibration evidence. Neither attachment can change `visualApproval`.

## Character Workshop Motion Debugger

Motion QA now creates an on-stage toggle panel for COM, support feet, semantic events, future trajectory, foot locks, weapon arc, interaction, hit direction, warp information, Pose Search ranking and layer order.

COM/support/semantic data comes from the actual Workshop actor and authored slash source. Gameplay-only evidence is consumed only when a real `__HUMANOID_LAB__` report supplies it; otherwise the UI displays `N/A`. In particular, Workshop does not invent a weapon-tip trajectory when real tip evidence is unavailable.

## Three-app runtime loading and crowd spacing

The previous shared consumers are now part of explicit boot paths:

- MURAAAAAAA loads `mura-master-characters.js` after the village boot, then wraps final actor sync with `mura-motion-crowd.js`
- 尽喰廻遊 loads `master-humans.js` and `motion-crowd.js` before the game creates `NightView`
- Rinne exports `HumanoidRuntime` from the final operational layer

Crowd spacing reads real resident/NPC positions and applies at most 0.18 m of presentation-only bias to the rendered human node. Navigation paths, resident/NPC x/z, AI state, save data and combat state are never written by the crowd adapter. Monster motion is not changed.

## Device calibration

The existing Rinne per-layer profiler remains split into base-motion, selection and weapon-contact. `createMotionDeviceCalibration` and `HumanoidRuntime.deviceCalibration()` provide a serializable evidence path.

`pixel-fold-class-30` / 5.5 ms remains a design target, not a measured result. `measuredHardware` can become true only with an explicit physical-device assertion, non-empty user agent, actual samples and an actual measured total. This session does not claim physical Pixel Fold measurements.

## Ragdoll boundary

No Rapier/Cannon/Ammo/Havok-style physics backend exists in the repository. The fail-closed ragdoll blend bridge remains the correct boundary; no fake physics implementation was added.

## Authority and compatibility

- Shino authored slash remains 0.66 seconds and contact phase .50
- Motion Warp target lock, no-homing and contact-stop behavior remain intact
- non-commit / swept sampling cannot advance operational motion state or apply Pose Search entry phase
- actor world transform, damage/contact, save data and network/multiplayer authority remain outside presentation
- numeric, browser and device diagnostics cannot auto-edit source or auto-approve visual quality
- main / Production / independent Visual Review Lab branch remain unchanged

## Validation boundary

Repository tests cover the shared operational contracts, kinematics QA, QA attachment/serialization, Rinne/shared parity and authority-source boundaries, real app boot wiring, crowd presentation authority boundaries, Workshop debug wiring and the inherited Motion Warp / mass / life / interaction / selection suites.

Exact-head normal CI, builds, actual WebGL browser smoke and Character Motion QA remain the Integration gate. Normal-speed human visual review and physical Pixel Fold measurements remain separate evidence, not inferred from numeric tests.
