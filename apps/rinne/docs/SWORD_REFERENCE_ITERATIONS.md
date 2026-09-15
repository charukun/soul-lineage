## Reusable basics and 序破急 reconstruction — 2026-09-15

The user clarified that spectacle must come from learned basic actions composed
into techniques, with techniques assigned to 序 / 破 / 急. A preliminary
performance-only aerial-spin candidate was discarded before publication.

- Added authored `sweep`, `round`, `leap`, `dash` to the real shared Shino rig,
  using existing gameplay action IDs. Round turns the whole normalized body;
  leap owns its flight envelope and folded-leg pose. No new attack clock, damage
  rule or discovery rule was introduced into the combat controller.
- Expanded slash counterbalance/follow-through and the heavy cut's torso hinge.
- `sword-techniques.js` defines three recipes per loadout and three basic actions
  per recipe using the game recipe field shape. The 30-second observation plays
  three alternative loadouts (27 actions), labelled 序 / 破 / 急. Charging holds
  the first source pose; native swing playback resumes afterwards.
- Review stage approaches remain observation controller placement. This is not
  a claim that the manual review score runs the gameplay tactical scheduler or
  exactly reproduces its automatic charge/footwork/recovery decisions.
- Single-action selection exposes all nine basics. The regular Lab can also
  select the new existing action IDs and compose them. Leap height follows the
  same basic-action envelope in the review transport.

Observed actual WebGL stills: dash lean/counterarm at 1.98 s, whole-body round at
5.90 s, folded airborne leap at 8.16 s, low sweep preparation at 4.98 s. The
same local Lab recorded the full 30 seconds at 1x, 30.622 s wall time, zero
browser/asset errors. The worker inspected stills, **not uninterrupted video**.
11 real-rig/viewer checks pass; original grip/contact/slip thresholds remain.
The source hash check now rejects observations if code changes during capture.
The prior 54/100 counter is not increased. Human approval and device fps remain
pending. See `active_batch.joha_kyu_followup` for exact source hashes/evidence.

The branch's pre-existing four-tab navigation assertions conflicted with its
new five-tab navigation. Concurrent Lab commits fixed those checks while this
candidate was being prepared. The final rebase retains the remote tests exactly;
the four navigation checks pass and all seven observed motion hashes still match.

---

## Internal Lab follow-up — 2026-09-15

Baseline `73d323ee917c5a592c808a7ad5fc1cd8b7e1c520`; current develop contracts
inspected at `a7a71862aa60b9f47ef4f42f05b0cc528585ed48`.

The existing five techniques / 29 cuts / 30 seconds now use a wider slash/reverse
support base, stronger lateral pelvis loading, delayed chest follow-through,
thrust counterarm opposition and a stronger heavy-cut torso hinge. Native clip
lengths, contacts, root/controller ownership and reviewed asset identity remain.
Source revisions: `shino-slash-12` / `shared-sword-13`.

The worker first hit the remote browser's WebGL failure and isolated localhost.
The actual internal Lab subsequently passed with Chromium 153/SwiftShader using
`review:local:setup -- --bundled` and `review:local`. Standard Playwright CDN
preparation timed out; the pinned npm bundle supplied a local browser without
changing sandbox/network policy. Vite and Chromium run in the same process tree.
Browser-native canvas recording avoids a second FFmpeg download. This procedure
is now routed from AGENTS and the Lab preview guide.

Before/after actual WebGL2 captures use the same model, lighting, 960x900 viewport,
3.33-second seek and front/side/three/back cameras. Both uninterrupted 1x playback
runs reached 30 seconds in about 30.2 wall seconds with no page/asset errors.
The matched front view shows the wider supporting silhouette; contact blade
direction remains stable in side view. CPU 4-second mesh samples additionally
show stronger reverse torso rotation and thrust counterarm separation.

Ten existing real-rig/viewer checks and the dedicated Lab build passed without
relaxing assertions. Source hashes, actual reports and remaining limitations are
in `sword-reference-iterations.json` → `active_batch.local_lab_followup`.
The reproducible evidence bundle is `rinne-motion-evidence.zip`; the after video
is `rinne-30s-dynamic.mp4`. Generated captures are not included in the game bundle.

Continuous video was **recorded, not observed** by the worker. The reference
excerpt was not re-viewed in this follow-up. Primary remains revise, polish and
human approval remain pending; the earlier 54/100 counter is not increased.
Physical-device fps, hair/cloth collisions and reference-level artistic quality
are not certified by a local software-WebGL success. Keep Lab PR #23 Draft and
use its existing asynchronous publication route; no CI polling or main promotion.

---

# Active 100-pass batch — 54 / 100 (2026-09-14)

This unfinished batch starts at Lab commit
`f2da2524a627e5e4057be1cd9a18e03a22b32282`. It does not reuse the fourteen
completed passes below. Thirty further source changes were made after reconciling the
latest remote Lab head, bringing this unfinished batch to fifty-four. Each new revision
was captured with the actual skinned SHINO rig at 30 fps from front-three-quarter
and side views. The final state was also captured as a 30 fps four-second combination
and a six-fps temporal sample of the full 30-second performance. The available reference was
`public/simulator/assets/review/reference-sword-4s.mp4` (original 2.5–6.5 s).

| Pass | Source before → after | Reference | Full-body finding, correction and comparison |
| --- | --- | --- | --- |
| 1 | `f2da252` → `c8deb5d` | 2.5–6.5 s | The knee plane stayed forward while the support foot and pelvis turned. The leg IK pole now follows the support-foot heading. Three-quarter and side captures show less crossed-knee silhouette; foot contact and loop tests remain green. |
| 2 | `c8deb5d` → `acb0461` | 2.5–6.5 s | The free arm read as an open, disconnected display hand. Its target now compresses toward the ribs during release and finger curl follows the phase. The rendered hand remains inside the counterguard instead of spreading away from the torso. |
| 3 | `acb0461` → `72af3d4` | 2.5–6.5 s | The head followed the full torso twist and briefly lost the opponent. Head yaw now counter-rotates toward the target while retaining authored follow-through. Captures show a steadier facing direction without freezing the neck. |
| 4 | `72af3d4` → `d14e0b9` | 3.16–4.0 s original | The uppercut pelvis rose abruptly under the blade. The leg drive is distributed before and through contact. The 30 Hz maximum pelvis-height step fell from the preceding recorded 90.2 mm to 77.3 mm in the final batch state. |
| 5 | `d14e0b9` → `88169fd` | 2.5–6.5 s | Resetting the free wrist in local space inherited forearm twist and could turn the palm up before snapping at the guard seam. The pre-IK world orientation is now restored after arm solving. The captured counterhand keeps a consistent neutral orientation. |
| 6 | `88169fd` → `6e2fc93` | 3.16–4.5 s original | Uppercut recovery rose before the following slash loaded, weakening momentum transfer. The low recovery is held to phase .73. The final sequence keeps the pelvis under the overhead finish longer before handing into the next cut. |
| 7 | `806c7f2` → `a89a300` | 2.5–3.5 s original | The slash torso turned, but the pelvis did not lead strongly enough. Wider opposing hip yaw now loads and drives the cut; front-three-quarter frames show a clearer full-body turn while the side silhouette stays planted. |
| 8 | `a89a300` → `8a9cb39` | 2.5–3.5 s original | Chest yaw crossed with the hips, flattening the kinetic chain. The chest now retains the coil through phase .46 and releases after the pelvis. Sequential frames show a more closed load followed by a later shoulder turn. |
| 9 | `8a9cb39` → `da7e0a1` | 2.5–6.5 s original | Composed slashes advanced almost straight ahead. Review-only slash travel was widened from 0.06 to 0.14 m laterally and from 0.42 to 0.46 m forward without changing combat movement. The four-second path now spans 0.220 m laterally instead of 0.120 m. |
| 10 | `da7e0a1` → `ded5d5f` | 3.0–4.0 s original | The reverse cut released chest and hips together. Additional chest keys retain positive coil until phase .48, then cross behind the hip turn; the contact/recovery sequence reads as a delayed upper-body return. |
| 11 | `ded5d5f` → `2f14eaa` | 3.5–5.5 s original | The thrust rose through contact and lost the low driving line seen in the reference. Pelvis height is held lower through extension; actual-mesh contact height fell from 0.938 m to 0.894 m while the rear leg remains extended. |
| 12 | `2f14eaa` → `2a7079c` | 4.0–6.5 s original | The heavy cut stood tall under the overhead hold. A deeper load and release compression lowers the sampled preload by 80 mm and the minimum pelvis by 25 mm, making the downward strike begin from stored leg compression. |
| 13 | `5754b59` → `dc89ec0` | 2.5–3.5 s original | The slash blade began leaving the loaded shoulder too early. The deep rearward blade pose is retained through phase .44, shortening the release window while keeping the planted side silhouette. |
| 14 | `dc89ec0` → `7c77671` | 2.5–3.5 s original | The slash stopped its arc too soon after contact. Blade yaw and roll now carry farther across the body at phases .59 and .72; three-quarter frames show a wider follow-through without changing the recovery endpoint. |
| 15 | `7c77671` → `85ec4a3` | 3.16–4.0 s original | The uppercut blade rose through a narrow, almost square pelvis. Opposing load and release yaw were widened so the support leg and pelvis visibly turn beneath the rising sword. |
| 16 | `85ec4a3` → `45abfc2` | 3.16–4.0 s original | Uppercut hips and chest unwound together. Intermediate chest keys retain the coil after the pelvis turns, then overtake through the overhead finish; support and sword attachment remain stable in both views. |
| 17 | `45abfc2` → `7dac4f4` | 4.0–6.5 s original | The heavy-cut chest fell with the hips and lost stored weight. The chest now holds back through phase .48 and drops after the pelvis, clarifying the whole-body downward chain. |
| 18 | `7dac4f4` → `5711c7b` | 2.5–6.5 s original | The reverse step did not counterbalance the preceding lateral slash. Review composition travel was widened from -0.12/-0.40 m to -0.18/-0.44 m; front frames show a clearer left-right phrase without changing gameplay movement. |
| 19 | `05930f4` → `6d29a74` | 2.5–3.5 s original | The slash centre of mass remained too centred through load and contact. Wider lateral pelvis offsets deepen the support-side load and carry the body farther across the strike; actual-mesh front and side sequences retain support contact. |
| 20 | `6d29a74` → `26bbb47` | 2.5–3.5 s original | Contact still read as an arm-led reach. Additional hip, spine and chest pitch drives the torso through the strike; the side sequence shows a deeper whole-body contact pose without changing the contact phase. |
| 21 | `26bbb47` → `5a02f89` | 3.5–5.5 s original | Thrust hips, spine and chest unwound together. New intermediate spine/chest keys retain the upper-body coil after pelvis release, then release it into extension; the actual-mesh comparison shows a modest pelvis-first sequence. |
| 22 | `5a02f89` → `3f2d417` | 3.5–5.5 s original | The thrust arm extended too early and flattened the speed contrast. A later reach hold preserves the bent loading arm to phase .45 and reaches full extension at the unchanged .50 contact. |
| 23 | `3f2d417` → `9acb4eb` | 4.0–6.5 s original | The heavy blade began falling evenly from overhead. Grip and blade now hold the overhead pose through phase .46, leaving a shorter fall into the unchanged .50 contact. |
| 24 | `9acb4eb` → `6a8a277` | 2.5–6.5 s original | Composed cuts still returned too close to neutral between techniques. Source recovery is carried to phase .84 with 180 ms overlap; front-three-quarter and side sequences retain more of the preceding low/high recovery while loading the next native cut. |
| 25 | `67c9e6e` → `43a2df9` | 2.5–3.5 s original | Deepened the slash support-side pelvis load; the actual mesh reaches a lower, wider anticipation. |
| 26 | `43a2df9` → `f3fc89c` | 2.5–3.5 s original | Increased hip, spine and chest pitch at the unchanged contact; the side view reads as torso-driven rather than arm-led. |
| 27 | `f3fc89c` → `4271ac8` | 3.16–4.0 s original | Lowered and coiled the uppercut preload so the rise starts from bent supporting legs. |
| 28 | `4271ac8` → `109bc5f` | 4.0–6.5 s original | Rejected: deeper heavy body keys caused a 0.1144 m high-to-low step. The body-key portion was restored in pass 37; this candidate was not adopted. |
| 29 | `109bc5f` → `1766697` | 3.0–4.0 s original | Widened reverse-cut hip yaw and counterstep; front frames show a broader left-right phrase. |
| 30 | `1766697` → `2a1917b` | 3.5–5.5 s original | Rejected: the deeper thrust body load produced 0.2363 m planted-toe slip. The load keys were restored in pass 37; this candidate was not adopted. |
| 31 | `2a1917b` → `45d3861` | 2.5–6.5 s original | Continued the four-second phrase with the same existing slash/back clips, removing most of the long neutral tail. |
| 32 | `45d3861` → `cbe1bac` | 2.5–3.5 s original | Preserved slash hip pitch and lowered pelvis into late recovery for a stronger handoff. |
| 33 | `cbe1bac` → `8b00598` | 3.16–4.0 s original | Expanded the uppercut grip/blade path from the hip to the overhead finish. |
| 34 | `8b00598` → `f831dc2` | 4.0–6.5 s original | Widened the heavy overhead and downward follow-through arc. |
| 35 | `f831dc2` → `96323bb` | 4.0–6.5 s original | Kept heavy recovery loaded so the next lateral cut inherits a lower centre of mass. |
| 36 | `96323bb` → `1fdb9a8` | 2.5–6.5 s original | Reduced head counter-rotation so the head follows full-body torque without losing the forward read. |
| 37 | `8ecd032` → `54b804d` | 3.5–6.5 s original | Restored the grounded heavy/thrust body keys after the regression; toe drift returned to `3.11e-8 m` and the high-to-low step to `0.090075 m`. |
| 38 | `54b804d` → `018714e` | 2.5–6.5 s original | Reapplied the longer existing-technique phrase after the grounded fix; it now passes at `5.40e-8 m` toe drift with no new attack IDs. |
| 39 | `018714e` → `774f18e` | 3.16–4.0 s original | Deepened the uppercut chest load and delayed its release behind the pelvis. Actual-mesh views show a more closed anticipation and wider overhead chest turn. |
| 40 | `774f18e` → `6b41001` | 3.16–4.5 s original | Retained forward hip/spine pitch through the uppercut finish, preventing the torso from straightening before the leg drive reaches the sword. |
| 41 | `6b41001` → `a5e5880` | 3.0–4.0 s original | Kept the reverse-cut pelvis lower and pitched across lateral contact. The cut reads less arm-led and retains `3.91e-8 m` planted-toe drift. |
| 42 | `a5e5880` → `2ef171f` | 4.0–6.5 s original | Began heavy-cut compression before release, making the legs store weight ahead of the unchanged contact instead of dropping only at impact. |
| 43 | `2ef171f` → `33df6f2` | 3.5–5.5 s original | Sustained thrust spine/chest reach into recovery without repeating the rejected deeper-foot candidate; grounded diagnostics remain passing. |
| 44 | `33df6f2` → `d6f6c96` | 3.5–5.5 s original | Pulled the free arm behind the ribcage during thrust extension. The sword arm now opposes a bent counterarm instead of sending both arms forward. |
| 45 | `0464f67` → `81b93c0` | 2.5–3.5 s original | Widened the slash pelvis path from support-side load through contact. Three-quarter and side actual-mesh frames show broader weight transfer without losing the planted foot. |
| 46 | `81b93c0` → `5f9ddca` | 2.5–3.5 s original | Carried slash pelvis yaw beyond contact instead of stopping the body under the sword hand. Recovery now retains whole-body rotation longer. |
| 47 | `5f9ddca` → `a7f3d6e` | 2.5–3.5 s original | Delayed the slash chest release behind the pelvis, then let it overtake after contact. The chain reads less like a single rigid torso turn. |
| 48 | `a7f3d6e` → `654b272` | 3.0–4.0 s original | Started the reverse cut from the pelvis before the chest and weapon. Actual-mesh frames show clearer support-to-countercut preparation. |
| 49 | `654b272` → `77cd32c` | 3.0–4.0 s original | Retained reverse-cut chest coil after pelvic release and enlarged its later overtake. The upper body no longer crosses at the same instant as the hips. |
| 50 | `77cd32c` → `bebb023` | 3.16–4.0 s original | Widened uppercut lateral support-to-apex travel. The rising sword carries the pelvis across the support line instead of following an almost vertical centre path. |
| 51 | `bebb023` → `3570508` | 3.16–4.0 s original | Delayed and expanded the uppercut chest turn at the apex. The torso follows the leg/pelvis drive rather than arriving with it. |
| 52 | `3570508` → `9b8f31f` | 4.0–6.5 s original | Pulled the free arm behind the ribs during the heavy overhead load and released it later. The bent counterarm opposes the sword instead of reaching forward with it. |
| 53 | `9b8f31f` → `176e6bc` | 4.0–6.5 s original | Increased heavy-cut pelvis wind-up and release yaw. The overhead-to-downward action gains a clearer whole-body turn while preserving contact timing. |
| 54 | `176e6bc` → `7ba23ed` | 4.0–6.5 s original | Held the heavy-cut chest behind the pelvis through release, then let it overtake into follow-through. Three-quarter and side frames retain grounding and a clearer kinetic sequence. |

New reproduction evidence for this run is in `/tmp/rinne-pass25-*` through
`/tmp/rinne-pass54-*` (`capture.json`, `three-follow-strip.jpg`,
`side-follow-strip.jpg`). The final sequence is `/tmp/rinne-batch-final-1709/`,
including `combination-three-30fps.mp4` and half/quarter-speed encodes. The latest
final sequence is `/tmp/rinne-batch-final-2009/`; the latest 30-second sample is
`/tmp/rinne-performance-final-2009/`. The final folder also contains generated
1x, 1/2x and 1/4x MP4 encodes. These are transient execution artifacts, not shipped
application assets. Every pass has a reconstructible
Git parent/commit diff; no source-neutral replay is counted.

The sequential frames and reference strip were inspected. Public Lab playback was
attempted, but Chrome reported `THREE.WebGLRenderer: Error creating WebGL context`;
the local MP4 could not be opened by the authenticated cloud browser's URL policy.
Therefore normal-speed actual-model playback remains unconfirmed and the primary stage
remains **revise**, the changes are not yet eligible for the three-app adoption PR,
and this batch remains 46 passes short. The generated 30 fps MP4 is not
treated as proof of normal-speed review or as human approval. Remaining work
is the reference's much larger lateral travel, whole-body rotation, release-speed
contrast and momentum transfer; WebGL/MToon, cloth collision and physical-device
fps also remain unverified.

Focused result at revision `shared-sword-12` / `shino-slash-11`: 13 actual-rig/viewer tests passed;
maximum final-combination socket error `1.3600950e-7 m`, moving planted-toe drift
`4.9428792e-8 m`, maximum 30 Hz pelvis-height step `0.0900786 m`, and minimum
blade-tip height `0.0562868 m`. `npm run build:review` also passed.
These are continuity diagnostics, not artistic scores.

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
