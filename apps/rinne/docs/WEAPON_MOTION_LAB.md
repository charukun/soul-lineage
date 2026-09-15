# Shared weapon motion and hand connection

Candidate: `shared-sword-15 / weapon-grip-1`. Continues the user's approved
`shared-sword-14` spectacle and `joha-kyu-sword-1` recipe score.

The nine learned basics remain slash, back, thrust, uppercut, heavy, sweep,
round, leap and dash. The 30-second score still composes three 3-action
techniques in 序 / 破 / 急, with three loadouts and 27 hits. Weapon selection
does not create a new action ID, replace the recipe, or change contact clocks.

## Changes

- `weapon-motion.js` adapts shared keys before rig IK. Sword retains its
  approved body keys and counterarm; great, katana, spear and axe receive
  centered grips, body torque, stance and loading adjustments. Long blades
  load diagonally above the floor. Spear thrusts align the shaft with the point.
- Both support-hand projection and rendering now read the same half-scale
  geometry specification. Previously, rendering applied the half scale after
  inverse grip translation while the support hand used the full scale.
- Carry and hand attachment use the same scale-before-inverse-grip matrix.
  Diagnostics now report rendered primary grip error as well as socket parity.
- The runtime and raw-rig adapter share anatomical finger closure and delta IK
  math. Shino's held thumb wraps toward the near side of the handle, avoiding
  the unreachable straight reach to the index joint through the shaft.
- The standalone viewer and the Lab's embedded performance controls offer
  five weapon choices plus hand detail. Changing equipment preserves the
  current technique/time and selects the corresponding shared baked clips.
- The preview renderer adapts existing simulator atelier silhouettes. It does
  not introduce newly approved production weapon assets. The extended great
  hilt has one pommel; the inherited short-hilt pommel no longer intersects
  its support palm. The Shino mesh itself is unchanged.

## Verification

`weapon-grip.test.mjs` uses the real Shino VRM for 5 weapons × 9 basics × 41
samples. Maximum raw-palm/actual-mesh grip gap is below 0.000000182 m; minimum
blade-tip height in these single-action samples is 0.0868 m. Thumb joints
remain outside the handle axis and oppose the curled fingers. These measure
transforms and joint placement, not complete skin/cloth collision clearance.

The focused authored-motion, grip, actual viewer/iframe bridge and raw-rig
tests pass (18 tests). Existing posture/gait checks also pass. The viewer test
changes weapons at the current timeline position, checks 30-second duration,
uses the actual iframe command bridge and rejects an untrusted message source.

Internal Vite + Chromium/SwiftShader loads the shipped VRM and actual WebGL2
viewer. Same-view before/after hand images and full-body views were inspected.
Normal-speed 30-second canvas recordings are evidence for human playback;
recording completion is not an assertion that the model watched the full video.
Human approval and physical Pixel Fold frame rate remain unmeasured.

Use the commands in VISUAL_REVIEW_PREVIEW.md for repeatable observation. Reports
contain hashes of 13 motion, grip and viewer modules and reject edits during
capture. Observational PNG/video evidence stays outside the static deploy.

## Scope

Shared simulator source and independent Visual Review Lab, Draft PR #23 on
`work/visual-review-lab-v2`. No develop/main merge or Production promotion.
The authored 9-action family adaptation is currently Shino-specific. Other
characters keep their existing motion fallback. Unrelated raw-asset inspection
clips in the main Lab retain their explicitly selected source/weapon metadata.
This is not exact auto-battle scheduler parity, new learning logic or a promise
that every specialized technique is interchangeable with every weapon.
