# Character Motion Quality Pipeline v1

The portable contract is `@soul/animations`; the Three.js adapter is
`@soul/rendering/motion-quality`. Character Workshop owns character, rig, body
variation and Motion QA. The independent Visual Review Lab branch owns detailed
skills/VFX choreography and can consume this contract without being merged into
the Workshop. No AI model client, credentials or repair service is embedded.

## Runtime order and ownership

1. Capture the humanoid's **rest** local and parent-world rotations once. The
   MasterCharacter pool exposes `motionRest` before any diagnostic pose/modular edit.
2. Normalize raw humanoid rotations into rest-world deltas. VRMA uses the existing
   per-model VRM bridge first; never apply normalized VRM tracks directly to raw bones.
3. Reset the target pose and retarget those deltas into its own rest axes. Only
   pelvis displacement scales by reference height; target limb translations remain
   target-owned. Missing tracks return to rest instead of retaining a prior pose.
4. Apply existing age, body, identity and modular geometry/length adjustments.
5. Run anatomical arm clearance, elbow bend-plane alignment and forearm/wrist twist
   sharing. Measure current limb lengths; do not assume Shino-sized arms. A capsule
   search first preserves the hand target, then permits a bounded forward clearance
   band in the current torso frame when the original arc is obstructed.
6. Calibrate the weapon in the measured raw palm frame, outside nonuniform body
   scale. Geometry-space grip points scale with the mesh. The profile includes grip,
   support grip, blade endpoints, rotation, scale and handedness. Two-hand profiles
   solve the support **palm**, accounting for its wrist offset.
7. Record diagnostics; secondary geometry/springs are a separate visual review.

The pipeline is presentation-only and opt-in. Workshop connects it to the existing
source motions. MURAAAAAAA residents and 尽喰廻遊 humans still use the existing
MasterCharacter production pool/modular contract; they gain the reusable rest
descriptor, but their world simulation, hitboxes, NPC state and current pose
callbacks are unchanged. The simulator's `readAsset` injection lets Workshop bake
its real source motions without changing the normal game/Lab asset-loading route.

The app bakes one 30-second source bank, disposes the source VRM, and shares immutable
pose data. Each crowd actor owns bones, correction state and presentation sockets.
The 1/6/12/30 controls retain existing records and edits. Thirty actors remain a
performance diagnostic, not a production performance claim.

## Policies, not blanket clamps

`inspectPose` separates warnings, allowances and explicit per-bone correction. The
default is expressive **warning only**. Shoulder, upper arm, elbow/forearm, wrist,
spine/chest, neck/head, hip, knee and ankle envelopes are screening heuristics, not
clinical limits. Non-finite quaternions are reported as rig errors. An external
worker must not interpret a quiet numeric report as visual approval.

Capsules cover arms/torso, hands/body, both arms, blade/body and blade/arms. Optional
clothing/hair proxies can be supplied by an asset adapter. Mesh skinning, garment,
hair and silhouette inspection remain explicitly `visualRequired`; absence of
proxies is not a pass. Source clothing is retained and no source weights are edited.

`stabilizeMotionBoundaries` applies shortest-arc quaternion interpolation only to
explicit transition ranges. Workshop repairs locomotion/draw/sheath boundaries;
the authored slash bank from 17–23 seconds, its .66-second action time and gameplay
contact windows are unchanged. Twist transfer is periodic at ±π to avoid a branch
flip. Fast release frames can still produce warnings and require visual review.

## Reproducible Workshop review

Open `characters.html` → **Motion QA** → **30秒レビュー**.

- Actual sources: `idle-01`, `walk`, `run-slow`, runtime draw/guard/sheath and the
  develop `authored-slash` choreography. No nonexistent VRMA is listed as available.
- 60 Hz source timeline, seek and ±1-frame controls; one playback takes 30 seconds.
- Eight versioned front/side/back/diagonal cameras; optional clock-driven tour.
  QA locks manual orbit, root rotation and secondary simulation so screenshots are
  comparable. Normal controls return on exit. Reference framing is independent of
  current pose bounds; viewport, DPR, selected individual and cohort span are inputs.
- Before toggles source poses/legacy grip ordering; after uses transition repair,
  anatomical correction and geometry-space grip calibration. Camera/time stay fixed.
- Capture the same character/frame/camera in both modes, then record the finding.
  JSON retains comparison image filenames. Copy the downloaded PNGs with the report
  when handing it to a worker; JSON alone does not embed screenshots.
- Reports use isolated `rinne.motion-qa.v1` browser storage and explicit JSON
  import/export. No game save, inventory or networking authority is accessed.

Initial reproduction: source slash phase ≈.72, Workshop time **17.475 s**, nearest
frame **1049**. Inspect front-left and right/back views, not only the front silhouette.

## Report / external worker contract

Schema: `character-motion-qa`, version `1`. `createQAReport`, `serializeQAReport`,
`deserializeQAReport` are the authoritative executable validators. Imports reject
unknown categories/statuses, invalid frame/camera data, malformed JSON, duplicate
IDs, non-finite numbers, excess nesting and documents over 1,000,000 characters.

| Field | Meaning |
| --- | --- |
| `build`, `reviewer`, `visualApproval` | Build identity, human/worker attribution, explicit pending/approved/changes-requested |
| `review` | Sequence/fps, motion revision, viewport/DPR, lighting, character records/parts/identity and secondary-motion policy |
| `issues[].character`, `motion` | Stable character and real source motion ID |
| `timestamp`, `frame`, `camera` | Reproduction location; seconds and nearest 60 Hz frame |
| `affectedBones`, `severity`, `category`, `note` | Localized cause hypothesis and human/worker observation |
| `before`, `after` | Nullable revision, image reference, timestamp/frame/camera/character snapshots |
| `status` | open / needs-review / resolved / accepted |
| `conditions`, `diagnostics` | Per-issue conditions and bounded numeric evidence |

Categories include model, rig, skinning / weight, motion, transition, weapon grip,
body variation, clothing, hair, self intersection, silhouette and unknown.

An external worker can read fixed review conditions + image pairs + an existing
report, produce a new report, propose a change to one of the common correction
targets, re-render the same conditions and request re-evaluation. `QA_WORKER_CONTRACT`
advertises these extension points. Automated vision, causal attribution, repair
execution and visual approval are **not implemented autonomous services**.

## Evidence and remaining limits

See [Shino initial QA case](qa/shino-arm-torso-v1.json). At the original source
follow-through the right upper arm crosses the torso and becomes occluded; this is
visible in the existing Lab runtime. Its IK used a fixed pole and reachable hand
target without torso clearance. Pure shortest-swing alignment also retained an
unsuitable upper-arm roll. Shared anatomical clearance and elbow-plane alignment
make the arm visible in the same frame without editing the asset or slash keys.

The actual shipped VRM/VRMA test samples the full reference sequence and 12 variants
(body/height extremes, 7/22/75 years). It checks improvement, finite poses, calibrated
palm contact, and unchanged character data. Capsule residuals and wrist/release
warnings remain; this is not collision-free mesh certification. The browser test
captures the source/after frame and 6/12 cohorts, exercises all motion boundaries,
8 cameras/tour, JSON round-trip and malformed import handling, and checks mobile
portrait/landscape bounds plus console/network errors.

Run `node --test packages/animations/tests/*.test.mjs apps/rinne/tests/motion-quality-rig.test.mjs`.
The existing Character Studio browser gate additionally invokes
`character-motion-qa.browser.mjs`; PNG/JSON evidence joins its existing artifact.
Physical Pixel Fold performance and final aesthetic approval remain separate.
Implementation delivery ends at Ready; Integration owns CI, merge and DEV publication.
