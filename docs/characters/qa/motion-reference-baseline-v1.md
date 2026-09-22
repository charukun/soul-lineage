# Motion reference baseline v1

This is a code-evidence baseline for the current `develop` motion runtime against the
public-technique benchmark in `@soul/animations`. It is **not** a visual approval and
it does not claim that a source pattern is good merely because code exists for it.
The primary technique reference is `achrefelouafi/SoldierThirdPersonThreeJS` at
`814a5631aaff1fdb0623be8e1e9356fefe772b43` (MIT).

Baseline inspected from develop `1e9ea9eaec5e5f21a3ece30527d32fce618c5fc4`.
The executable benchmark requires complete measurements; this document therefore
uses `supported`, `gap`, and `not-proven` rather than inventing placeholder numbers
for data the runtime does not yet emit.

| Criterion | Baseline | Repository evidence | Next correction / instrumentation |
| --- | --- | --- | --- |
| `locomotion.phase-sync` | supported | `HumanoidRuntime.measureLocomotion()` measures walk/run cycle distance from low-foot travel. `tick()` advances the single `_humanoidPhase` from actual actor speed and the selected gait's measured cycle distance; `sample()` maps that normalized phase onto the chosen clip. | Add an adapter that records the phase immediately before/after the walk/run threshold so the executable benchmark can assert the maximum phase error instead of relying on code inspection. |
| `locomotion.speed-match` | supported | The same `tick()` expression advances gait phase by `speed * dt / cycleDistance`; this is the current runtime equivalent of changing clip playback rate from actual ground speed. | Emit measured actual speed, cycle distance and effective phase/playback rate into Motion QA evidence. |
| `root-motion.single-authority` | supported with evidence gap | `sample()` resets the presentation root, evaluates the pose, then places `c.root` from authoritative actor `px/pz`; authored slash explicitly says it contains no actor displacement or game state. Current slash rig tests assert actor `x/z` remain zero. | Record whether each imported clip has horizontal hips/root translation and whether it was frozen or extracted. World transform ownership is clear, but clip-horizontal policy is not yet machine-readable. |
| `attack.phase-order` | gap | The slash has launch/contact/plant/chain timing and authored body preparation, but no target-relative `turnEnd` / `warpStart` contract. | Add explicit turn → approach → contact → recovery phases when target-relative attack approach is implemented; preserve the existing `.66 s` slash and combat contact clock unless gameplay deliberately changes them. |
| `attack.motion-warp` | gap | `authored-slash.js` is presentation-only and states that it has no actor displacement. The real-rig test asserts actor `x/z` do not move through the slash. There is no target lock, bounded standoff approach or controller-owned warp in the shared motion path. | Introduce bounded target alignment as a controller-owned presentation/gameplay bridge, never by teleporting the visual root independently of authoritative actor movement. |
| `impact.single-beat` | not-proven | The inspected shared Motion QA path exposes attack/contact pose and hit-reaction animation, but it does not emit one benchmark record proving hit-stop, camera impulse and reaction were fired from the same contact beat or that camera shake uses real time. | Instrument the existing combat/VFX boundary with one contact event record before changing feel. If any of the three pieces is absent, improve it there rather than fabricating it inside `@soul/animations`. |

## Why the first implementation target is motion warping

The current authored slash already has detailed full-body pose work: guarded seam
poses, hips/chest sequencing, planted-foot checks, forward knee checks, hand/socket
attachment and acceleration through contact. The missing target-relative layer is
therefore higher leverage than replacing those poses. A bounded approach can let the
same authored cut meet an opponent at a readable distance while preserving the
existing contact clock and the actor/controller as the only world-transform owner.

The reference does not become a dependency. No external source, model, animation or
asset is copied into this repository. Future correction work should use this baseline
as a checklist, generate real benchmark evidence from the local runtime, then perform
the existing eight-view human visual review. A green benchmark can never set
`visualApproval`.
