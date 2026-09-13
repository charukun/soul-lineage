# Authored slash in Visual Review Lab

Source: PR #115, commit `a49ff7c9123de88dd581fcf59fb122cece130ea9`.
Lab base: `158bf987713bd3ae8db89c502fa6c6584f815176`.

The user requested independent publication of the authored Shino slash to the
existing Visual Review Lab, without waiting for develop Integration.

The Lab home has **今回の斬撃を確認**, linking to
`/simulator/motion-review.html`. The page starts the Shino sword slash immediately
and provides pause/restart, speed, seek, frame steps, orbit and camera presets.
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
