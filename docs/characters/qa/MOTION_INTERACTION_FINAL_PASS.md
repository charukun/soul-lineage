# Motion Interaction Final Pass

This work extends the current motion-quality stack from single-character presentation into paired interaction, locomotion transitions, motion personality, degraded-body states, network reconciliation and deterministic frame diagnostics while preserving gameplay authority.

## Shared runtime

`@soul/animations` owns the portable source of truth. `motion-runtime.js` provides:

- start / stop / pivot / turn-in-place state derived from speed, yaw delta and planted side
- bounded motion personalities: neutral, calm, aggressive, timid, proud, elderly, child, heavy and nimble
- fatigue / injury presentation profiles with per-leg stride, limp, weapon sag, shoulder drop, breathing, gaze stability and recovery scale
- deterministic micro motion for breathing, body sway, head motion, blink and grip pulse
- body-proportion adaptation for reach, stride, stance, tempo and weapon arc intent
- bounded two-body world-space anchor correction split by participant mass
- a single-serial paired impact response with attacker and defender presentation recoil and `singleDamageEvent: true`
- motion sync frames that distinguish authoritative fields from locally reconstructed presentation fields
- reconciliation diagnostics for clock, phase, yaw, position, target and impact divergence

`@soul/rendering/motion-runtime` is only a thin adapter. The game apps continue to depend on rendering and do not import one another.

## Three-app consumers

The shared runtime is consumed by the existing MasterCharacter presentation boundaries:

- Village / MURAAAAAAA: resident age, role, task, movement and optional stamina/injury data choose personality, fatigue and locomotion presentation. Child/elderly, guard/mayor/work profiles, breathing, blink and pivot/stride changes are applied to the cloned character bones only.
- Demon / 尽喰廻遊: human NPC role and flee/pursue state select personality and locomotion presentation; knight/hunter/smith/caster/support roles remain gameplay-owned and are only read for presentation.
- Rinne: `HumanoidRuntime` now ends in `humanoid-interaction.js`, layered after the existing natural-stance, dynamics and life passes.

Neither Village nor Demon writes NPC/resident x/z/yaw/task/state/save data from the motion runtime. Rinne likewise never writes authoritative actor x/z/yaw, HP, damage or network state from the interaction layer.

## Rinne interaction and combat response

- personality, fatigue/injury and micro posture corrections are applied before the existing ground/foot-lock solve, so final planted feet still own contact
- dynamic condition/personality is not baked into cached attack clips
- explicit `_motionInteraction` metadata accepts a partner and world-space anchors; it applies a bounded presentation-only rigid correction and keeps weapon endpoints, sockets, carried/sheath matrices and shadows aligned
- no social/carry interaction is inferred from ambiguous gameplay state. Village `carry` was confirmed to represent furniture transport, so it is deliberately not treated as parent/child carry
- Impact Beat keeps one damage/contact event. The defender consumes the existing reaction beat. If the beat contains an `actorId` that matches a real actor exposed by the runtime, that exact same beat is also routed to the attacker for a short equal/opposite presentation recoil. Missing actor identity causes no inferred attacker response
- Motion Warp's locked target remains the gaze provider and is also consumed by the motion sync frame when available
- non-commit swept weapon/contact samples never advance locomotion history or apply paired/interaction transforms

## Multiplayer contract

`MOTION_SYNC_CONTRACT` marks actor id, sequence, clock, gameplay state/phase, locked target, impact serial, authoritative position/yaw and condition as deterministic inputs. Micro motion, secondary motion, finger grip, gaze, corrective/terrain presentation and silhouette QA are reconstructed locally.

The work does not add a network transport or replace `@soul/network`; it defines and validates the motion reconciliation contract that transport can consume. Large clock/position errors or a changed impact serial request a presentation reseed rather than silently inventing gameplay state.

## Frame and perceptual QA

`motion-frame-qa.js` compares deterministic RGBA captures and normalized landmarks. Evidence is fail-closed for malformed numeric/schema data and always records `visualApprovalRequired: true`.

Frame evidence is optional on the existing `character-motion-qa` v1 report and cannot change `visualApproval`. The existing Character Motion QA browser route already captures actual WebGL frames at repeatable timestamps/cameras; PR browser smoke now invokes that dedicated QA whenever Rinne humanoid/motion code or shared animation-motion code changes. This supplements rather than replaces the normal game browser smoke.

The previous perceptual QA remains active for eight-view silhouette readability, weapon trajectory speed/acceleration/jerk, reversals and jitter.

## Authority and compatibility

- Shino authored slash remains 0.66 seconds with the established contact/active/launch/plant/chain timings
- controller-owned Motion Warp target snapshot/no-homing/contact-stop behavior is preserved
- swept weapon sampling, damage/contact authority, save state and multiplayer/gameplay state remain outside presentation
- two-body anchor correction and paired recoil are bounded visual transforms only
- main / Production and the independent Visual Review Lab branch are unchanged

## Validation boundary

Focused pure/runtime validation covers shared motion profiles, locomotion transitions, two-body mass split, fatigue/injury, deterministic micro motion, paired response, body adaptation, sync/reconcile, Rinne/shared parity, authority-source checks, three-app consumer boundaries and frame-QA fail-closed behavior.

Numeric diagnostics, screenshots and frame comparisons do not establish reference-level quality. Exact-head normal fast/browser CI, actual WebGL capture and human normal-speed visual review remain the Integration/visual-approval gate.

## Supersession

PR #222 is the latest-develop final integration PR for this motion stack. It carries forward the verified work from PR #209, so #209 should be closed as superseded only after #222 is Ready for review. No direct develop/main write is used.
