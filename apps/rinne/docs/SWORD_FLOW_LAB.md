# Shino: connected four-second sword phrase

The user rejected `shino-performance-1` for insufficient dynamism and approved
focusing first on a short, visually inspected phrase before expanding it to 30 s.
This batch is `shino-flow-1`, based on Lab commit
`0faf4b55395b1a9387c6b32bb8c138ebf4fb79eb`.

## Review

Lab home: **作り直した4秒連撃を確認**.
Entry: `/simulator/motion-review.html?mode=flow`.

The actual Shino model automatically plays a four-second phrase once. Use
**最初から** to repeat; repetition can also be enabled explicitly. The initial
view keeps the floor/camera fixed to make actor travel visible. Trails start off.

The mode selector offers the new phrase, **従来の単発接続**, the preceding 30 s
score, and the approved single slash. The baseline plays the existing slash,
backhand, rising and heavy clips consecutively with their old full recoveries;
it is a four-second comparison assembled from the existing clips, not a frozen
copy of the complete old 30 s recording.

**参考動画と並べる** places a cropped excerpt from the user-provided
`1000003098.mp4` next to/above the live model. Both use the player's pause, speed,
seek and frame controls. The excerpt covers 2.5–6.5 s of the supplied recording,
retains only its gameplay area and omits audio. It is a visual reference for the
footwork, body rotation and connected cuts, not a frame-exact pose reconstruction.
Following the user’s additional suggestion, the excerpt was also prepared at
quarter speed and the first cut was inspected as 20 successive samples across
one second. The in-Lab reference supports the same 1/4 speed selection.
Some feet are obscured by effects in the recording, so hidden joint positions are
not claimed as measured reference data. The source recording shows a Tomat post.

## Motion changes

- `public/simulator/src/sword-flow.js` contains one continuous whole-body phrase.
  Weapon, pelvis, spine, chest and head keys remain loaded between strikes.
- Root travel and rotation are sampled separately from the pose. The actor moves
  about 2.27 m on the actual adult Shino scale, including travel during every hit.
  The canonical sampler exposes desired root motion; a game caller remains
  responsible for its movement/collision rules. Rendering does not mutate it.
- Each leg has authored world-space support anchors and separate lifted steps.
  Feet are transformed into the moving actor's local space before solving IK.
  Rear-foot release is timed to front-foot landing, avoiding an overstretched
  planted leg. Four strikes have separate active intervals and different cadence.
- The existing canonical HumanoidRuntime consumes the phrase as sword `flow`.
  The longer phrase is baked at 360 intervals; existing short cuts stay at 90.
  The approved single-slash keys/timing are unchanged. Optional authored feet are
  supported by the existing shared rig application, not a second skeleton engine.
- Viewer clips are prepared before playback. The old 50 ms frame-time clamp is
  relaxed to 250 ms so ordinary sub-20-fps rendering cannot halve playback speed.
  Hidden-page resume still resets the wall-clock baseline.

Normal game inputs, collisions, combat balance, the previous 30 s score,
`develop`, `main`, Production and deployment workflows are outside this batch.
The long-lived Lab PR #23 stays Draft. This phrase still requires the user's
visual approval before it becomes the quality basis for the longer score.

## Visual inspection and corrections

Actual skinned meshes and source textures were rendered on CPU at 30 fps from
this same runtime. Three-quarter and side contact sheets were inspected. The
first pass exposed an 80.8 mm support-anchor error late in the first lunge and a
50.1 mm error late in the rising cut. Advancing rear-foot liftoff and lowering
the rising-cut pelvis slightly removed the reach conflict without reducing root
travel. Final support-anchor error is 0.670 mm in the 60 fps rig check.

[Final pose sheet](media/shino-flow-poses.jpg)

[Four-second rendered evidence](media/shino-flow-proof.mp4)

These renders verify pose/footwork/silhouette progression on the actual model.
The CPU renderer uses simplified lighting, not the browser's complete WebGL/MToon
pipeline. They do not prove mobile fps or equivalence to the reference footage.

Reproduce the optional capture with Node 24, Python, numpy, Pillow and numba:

```sh
node apps/rinne/scripts/capture-sword-flow.mjs /tmp/rinne-sword-flow
python apps/rinne/scripts/render-sword-flow.py /tmp/rinne-sword-flow three --all
```

These are manual visual-iteration tools, not mandatory CI or a new heavy Lab gate.

## Checks

- `node --test apps/rinne/tests/authored-slash.test.mjs`: five tests pass. Existing
  slash/score checks retained. New actual-model checks cover all four hit windows,
  forward knees, fixed support anchors, grip, ground clearance, movement during
  hits, loaded inter-hit poses and cut acceleration. Maximum grip error
  0.000000138 m; minimum blade-tip height 0.1096 m.
- `node --test apps/rinne/tests/sword-flow-viewer.test.mjs`: the real viewer code
  and real model/rig exercise autoplay, pause, speed, seek, frame step, reference
  synchronization, mode changes and the once endpoint. Browser surfaces and GPU
  drawing are substituted; this test does not establish rendered appearance.
- `npm run build:review`: successful focused checks/build/static asset validation.
  Final Worker publication uses the existing dedicated Lab workflow.

External smartphone push is not recorded as delivered: no configured destination
or existing notification command is available in this session. GitHub commit,
PR and deployment status remain the persistent completion record.
