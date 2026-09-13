# Existing sword motions in Visual Review Lab

The user asked to improve the existing motions and combine them. The previous
standalone `flow` attack did not meet that intent. This batch removes it and uses
the existing five sword techniques throughout the Lab.

## Shared source and playback

| Existing kind | Technique | Native duration |
| --- | --- | --- |
| `slash` | 流し斬り | 0.66 s |
| `back` | 斬り返し | 0.69 s |
| `thrust` | 刺し貫く | 0.67 s |
| `uppercut` | 斬り上げる | 0.74 s |
| `heavy` | 叩き斬る | 0.98 s |

`authored-slash.js` and `authored-sword.js` remain the pose sources consumed by
`HumanoidRuntime.bakeArmed`. Hand chambers and follow-throughs move forward of
the ribs; the rising cut loads slightly lower, and thrust reach stays within the
arm's working range. Existing whole-body and leg keys remain in use.

The main Lab adapter now retains the thrust's lower-body tracks and no longer
replaces the slash hand path after sampling. It converts the runtime's normalized
clip to its native seconds before normalized-to-raw rig remapping. There is no
separate Lab pose copy or Lab-only 1.28 s slash stretch.

`sword-sequence.js` contains only a list of existing kinds and their timing. In a
connected sequence, the preceding recovery ends at phase 0.82, the next clip
enters at phase 0.18, and the two overlap for 80 ms with a smooth blend. Original
cut speeds and active windows remain intact. The runtime and Lab raw-rig player
sample the same two clips at the same phases; seeks do not require playback
history, including when a technique is repeated.

The main Lab's existing **技構成** applies this connection to two or three of
these sword techniques. Other technique combinations keep their existing
playback. The dedicated viewer offers:

- `?mode=sequence`: the existing 30 s route and 17 attacks, grouped into phrases
  composed from the five improved techniques. Walk/run motion and route remain.
- `?mode=combination`: slash → back → uppercut → heavy in a four-second review
  window, including the final guard. Old `?mode=flow` links resolve here.
- `?mode=baseline`: the same four improved techniques played through their full
  recoveries. This isolates the effect of connecting them; it is not an old build.
- `?mode=single`: each of the five existing techniques can be selected separately.

The reference excerpt, quarter-speed playback and frame stepping remain available
for the short comparison. This update aligns and improves the reusable motions;
it does not claim frame-exact reconstruction or reference-level motion quality.

## Verification

- `node --test apps/rinne/tests/authored-slash.test.mjs apps/rinne/tests/sword-sequence-viewer.test.mjs`:
  seven tests pass using the actual Shino VRM and shared runtime. Checks cover
  unchanged combat timing, socket attachment, planted-foot drift, all composed
  hit windows, repeated technique IDs, 30 s route boundaries, raw-rig parity,
  autoplay, seeking, speed/reference sync and all five single-technique choices.
- Maximum four-technique socket error: 0.000000131 m. Minimum blade-tip height:
  0.239 m. A 1 microsecond sample across sequence joins changes the blade-tip
  position by at most 0.00000777 m. Maximum raw-rig rotation difference between
  Lab composition and the normalized source composition: 0.000000079 radians.
  These are continuity/rig checks, not measures of artistic quality.
- Actual skinned meshes and textures were captured at 30 fps. Three-quarter and
  side contact sheets were inspected for hand clearance, cut silhouettes and
  inter-cut poses. CPU rendering uses simplified lighting; browser WebGL/MToon
  appearance and mobile performance are not established by these checks.
- `npm run build:review`: focused playback/asset/retarget checks, build and static
  asset validation. No new heavyweight CI or full E2E gate is added.

Optional visual reproduction (Node, Python, numpy, Pillow and numba):

```sh
node apps/rinne/scripts/capture-sword-sequence.mjs /tmp/rinne-sword-sequence
python apps/rinne/scripts/render-sword-flow.py /tmp/rinne-sword-sequence three --all
python apps/rinne/scripts/render-sword-flow.py /tmp/rinne-sword-sequence side --all
```

The renderer's historical filename is retained because it is a generic mesh
renderer; the capture now exclusively uses the existing clip composition.

## Publication scope

Use the existing `work/visual-review-lab-v2` branch, Draft PR #23 and dedicated
`rinne-visual-review` Worker. No develop/main merge, Production promotion, workflow
change or new attack kind is part of this batch. Follow the latest execution
policy's single short post-push status check; do not wait or poll for CI.
External smartphone delivery is unconfirmed; no destination is inferred.
