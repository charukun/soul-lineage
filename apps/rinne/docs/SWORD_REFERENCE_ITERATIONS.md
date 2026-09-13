# Fourteen further reference-driven corrections

This batch starts at Lab commit `40dd14d92ac1cf69c357db563fb548476b578fc3`.
These are fourteen new source-correction/capture/comparison iterations, separate
from the six corrections recorded in the preceding batch. Every pass changed
source, captured the actual skinned Shino VRM, and was visually inspected against
the supplied `1000003098.mp4`. Individual poses, frame sequences, side views and
three-quarter views were used to inspect loading, release and recovery. The final
before/after video includes real-time and frame-held quarter-speed playback.

The reference is a 33.297-second phone capture. The main studies were the
2.5–6.5-second and 14–18-second sequences, plus closer rising/downward-cut excerpts.
Effects, grass and costume obscure some contacts: this is a visual study, not
measured joint reconstruction or extracted motion capture.

| Pass | Capture | Reference interval | Finding and correction |
| --- | --- | --- | --- |
| 1 | `slash` | 2.5–3.2 s | Lowered and widened the loading blade arc around the shoulder; inspected side and three-quarter mesh views. |
| 2 | `slash` | 2.5–3.2 s | Lowered the lead/recovery foot lift and deepened the pelvis/torso loading; reduced the marching-step silhouette. |
| 3 | `back` | 3.0–3.5 s | Loaded the reverse cut from the preceding low follow-through. Rendered elbow stayed near 30 degrees throughout, revealing an IK reach-limit problem. |
| 4 | `back` | 3.0–3.5 s | Added phase-dependent sword-hand reach. The native back cut now bends about 81 degrees during loading and extends at contact. |
| 5 | `uppercut` | 3.16–4.0 s | Lowered loading and raised the blade to a clear overhead apex. Inspection exposed a straight counterarm and insufficient planted-leg reserve. |
| 6 | `heavy` | 4.16–5.0 s | Held the blade behind vertical before a faster downward release, with deeper torso hinge and lower step lift. |
| 7 | `thrust` | 3.0–4.5 s | Compressed the loaded arm/torso and lengthened contact extension; preserved the original native hit clock. |
| 8 | `uppercut` | 3.16–4.0 s | Coupled the free arm and its pole to torso yaw, with a 90-percent reach reserve; eliminated its straight-arm apex. |
| 9 | `combination` | 2.5–4.5 s | Projected ground targets into reachable leg arcs and lowered rear lifts. Moving-rig verification exposed 17.76 mm of planted-toe slip at the uppercut apex; this pass was not accepted as final. |
| 10 | `combination` | 3.16–4.0 s | Lowered the uppercut apex to preserve knee reserve; the existing 5 mm planted-toe test passed without relaxing its threshold. |
| 11 | `combination` | 2.5–4.5 s | Carried original recovery through phase 0.80 and increased overlap from 80 to 140 ms. Contacts still use native clocks; high-to-low connection remained too abrupt. |
| 12 | `combination` | 3.16–4.5 s | Settled the uppercut under its overhead blade before the next slash. The largest remaining height step moved to the preceding back-to-uppercut join. |
| 13 | `combination` | 2.5–4.5 s | Kept the back-cut recovery low, eliminating its stand-up/reset before the next loading pose. Maximum 30 Hz pelvis height step fell to 90.2 mm. |
| 14 | `combination` | 2.5–3.5 s | Extended the slash grip forward at contact and through follow-through. Native slash elbow bend at contact changed from 67.8 to 30.4 degrees, visibly strengthening the forward cut. |

## Reproducible correction record

[sword-reference-iterations.json](sword-reference-iterations.json) contains the
baseline commit, ordered source deltas, full source SHA-256 hashes and measured
capture metrics for all fourteen passes. Applying each delta to the four named
baseline sources reconstructs that intermediate source state. The measurements
are diagnostics, not an artistic quality score. Captured binaries and frame
images are optional evidence and are not included in the runtime/deploy bundle.

The capture script now records attack kind/phase, root and raw joint positions,
so a clamped elbow can be distinguished from a deliberate pose. Rendering still
uses the real mesh and textures with simplified CPU lighting. Browser WebGL,
MToon, device frame rate and cloth collision were not verified in this session.

## Final behavior and regression checks

- The same five native techniques drive both individual playback and composition.
  The seven-cut short sequence lasts 2.6306 seconds inside its four-second window;
  the existing 30-second performance retains five phrases and 29 attacks.
- Sword arms bend about 81–88 degrees during loading and extend to about 30.4
  degrees at contact. Counterarms retain at least 51.7 degrees of bend across
  the individually sampled five attacks. Walking/idle arms are not included in
  that claim.
- On the moving short sequence, planted-toe drift is below 0.000000038 m,
  backward pelvis increment below 0.000600 m at 120 Hz, and maximum vertical
  pelvis step is 0.0902 m at 30 Hz (0.2080 m at pass 9).
- Minimum blade-tip height across five individual attacks is 0.1878 m. Maximum
  composition socket error is below 0.000000134 m. The 30-second event-boundary
  blade jump is below 0.00412 m. These tests establish continuity/attachment,
  not equivalence to the reference's visual quality.
- Ten focused tests pass, including new actual-rig arm articulation and
  high-to-low join regression checks; the existing combat clocks, hit windows,
  contact guards and normalized-to-raw Lab pose/travel parity still pass.
- `npm run build:review` is the release build/static check. Its nine focused
  playback/retarget/asset tests also pass. No new CI/browser gate is introduced.
- Final captures cover the full four-second sequence (121 frames) and full
  30-second performance (901 frames). The broader overhead cuts also require
  more camera margin in performance mode; this display adjustment accompanies
  the motion corrections. At 30 Hz, conservative mesh bounding boxes fit all
  four views at aspect ratios 0.6, 1.0 and 1.8 for both sequences (24 cases).
  This checks the camera equations and geometry, not a browser screenshot.

An additional legacy structural check, `review-lab.test.mjs`, fails on its
pre-existing `レビュー情報をコピー` text assertion. The parent commit already has
that assertion and the same `review.html` without that label. This batch does
not alter either file or relax the assertion. The focused motion/viewer tests
and the dedicated Lab build/static checks above pass.

## Latest develop and publication scope

Latest develop `1a0a40d` was inspected, including merged PR #133. Its modular
production-actor motion-quality pipeline has a separate opt-in consumer. This
batch corrects the Lab's existing canonical simulator/normalized-clip/raw-rig
path; it does not claim to import that separate pipeline or change every game
animation consumer.

During publication, Lab commit `7da46db` added the Shino Reference v2 preset.
That independent change is preserved by rebasing this batch onto it; it does
not change the four motion sources used for the comparison baseline.

The existing Lab exception in `docs/DEVELOPMENT.md` applies: use
`work/visual-review-lab-v2`, Draft PR #23 and the dedicated preview Worker.
The shared default hand reach remains unchanged for other callers. Gameplay
input, damage, native hit timing and the authoritative movement controller are
unchanged. No develop/main merge, Production promotion or control-workflow
change is part of this batch. Public status is checked once after push; pending
publication is reported as pending. `NTFY_TOPIC_URL` is not configured here, so
smartphone notification delivery is unconfirmed.
