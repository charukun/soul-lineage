# Authored slash in Visual Review Lab

Source: PR #115, commit `a49ff7c9123de88dd581fcf59fb122cece130ea9`.
Lab base: `158bf987713bd3ae8db89c502fa6c6584f815176`.

The user requested independent publication of the authored Shino slash to the
existing Visual Review Lab, without waiting for develop Integration.

The current Lab home opens **既存の技で30秒演武**, linking to
`/simulator/motion-review.html?mode=sequence`; see
[existing sword motions](EXISTING_SWORD_MOTIONS_LAB.md) for the latest changes.
The same viewer offers all five improved individual techniques at `?mode=single`
and a four-technique composition at `?mode=combination`, with pause/restart,
speed, seek, frame steps, orbit and camera presets.
Its back link returns to the Lab home. No model or clip selection is required.

The canonical simulator runtime and its dependency closure are brought forward
from PR #115 at their existing paths. The viewer imports those same modules and
uses the existing Shino VRM; there is no parallel animation implementation or
copied model asset. The older Lab runtime lacked the authored motion's grip,
contact and age helpers, so copying only the choreography was insufficient.
The Lab posture adapter now explicitly samples its existing adult actor at age 22.

Publication uses the existing `review-preview.yml`, `wrangler.review.jsonc`,
`work/visual-review-lab-v2` and `rinne-visual-review` Worker. PR #23 stays Draft.
The existing Lab sequence controls, feedback UI and asset catalogue remain in
place. Normal develop / main / Production promotion is outside this update.

Verification: run the real-rig `authored-slash.test.mjs` and `npm run build:review`.
The latter runs the existing focused playback/asset/retarget checks and static
asset limits. Confirm the live home link and published module hashes after the
Worker reports successful deployment. Human motion quality approval remains with
the user; CPU bone tests do not establish reference-footage parity or device fps.


## 30-second automatic performance (shino-performance-1)

User approved the published single slash at Lab commit
`0b1161c4db14f8255cfe4c067bf758812c04c38e` and requested a roughly 30-second
combination following the first attached video (`1000003098.mp4`, 33.297 s).
The reference's approach / consecutive cuts / flank / re-engage / larger cut
rhythm is choreographed into 30.0 seconds. This is authored movement inspired by
the recording, not frame-exact reconstruction, motion capture or copied enemies.

- `authored-slash.js`: the approved slash keys/timing are unchanged. Rig application
  is extracted into `applySwordPose` for the companion cuts.
- `authored-sword.js`: backhand, rising cut, thrust and overhead cut use distinct
  hand/blade/body keys with the same rig, grip solver and support-foot schedule.
- `sword-performance.js`: deterministic score of 17 strikes, five types, five
  phrases and eight movement sections. Quintic root movement, shortest-angle turns,
  signed distance-matched walk/run phases and return to the initial position.
- `motion-review.js`: seconds-based playback, automatic start from the Lab entry,
  repeat switch, pause/restart, 1/2 and 1/4 speed, seek, one-frame steps, camera
  following and presets. A short optional ribbon uses the real blade sockets.
  Single-slash mode keeps its 0.66 s timing and no effects. Recent-state warmup
  supports seeking without replaying the entire score on each touch.

The new cuts are canonical simulator modules on the Lab branch, consumed by the
existing HumanoidRuntime. No VRM, VRMA, animation engine, game entry, workflow,
Worker configuration or normal DEV/Production branch is duplicated or changed.
PR #23 remains Draft for the new performance's visual review; PR #115 is unaffected.

Focused verification: `node --test apps/rinne/tests/authored-slash.test.mjs`
passes four tests using the actual shipped Shino rig. The approved slash retains
its prior metrics (maximum grip error 0.000000119 m; planted toe drift 0.001876 m).
New checks cover 30 s coverage, all 17 strikes, finite keys, exact root/gait
continuity, companion-cut contact and forward knees, and rig transitions at every
score boundary (largest measured blade displacement 0.004244 m).
`npm run build:review` also passed: nine existing focused tests, workspace syntax,
Vite build and static asset limits (87 files, none above 25 MiB). CPU tests do not establish rendered
appearance, device performance or parity with the reference. The user's device
is the visual approval surface per the Lab policy.

External smartphone notification is not sent: no existing configured destination
or notification command is available in this workspace/session. Do not equate the
chat response or a successful deployment with delivered external notification.
