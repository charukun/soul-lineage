# Existing sword motions in Visual Review Lab

The user requested repeated correction against the original reference video,
using and improving the existing techniques. The shared sources now give the five
cuts distinct full-body motion, connect seven cuts in the short review, and use
29 cuts in the existing 30-second route.

## Shared source and playback

| Existing kind | Technique | Native duration |
| --- | --- | --- |
| `slash` | 流し斬り | 0.66 s |
| `back` | 斬り返し | 0.69 s |
| `thrust` | 刺し貫く | 0.67 s |
| `uppercut` | 斬り上げる | 0.74 s |
| `heavy` | 叩き斬る | 0.98 s |

`authored-slash.js` (`shino-slash-3`) and `authored-sword.js` (`shared-sword-3`)
remain the sources consumed by `HumanoidRuntime.bakeArmed` and the Lab adapter.
The slash uses staggered pelvis/chest rotation and a longer lead step. Back cut
opens the opposite side; thrust lowers into a longer stance; uppercut compresses
then rises; heavy loads high and finishes low. Grip targets carry with the moving
pelvis, keeping the hands in front of the ribs and maintaining elbow room.

`sword-sequence.js` lists only existing clip IDs and their connection times.
Connected recoveries end at phase 0.72, the following clip enters at phase 0.18,
and they overlap for 80 ms. Original clip speed and active windows remain intact.
No new attack ID or independent review pose is introduced. The main Lab's
**技構成** uses the same connection when two or three sword techniques are selected.

The shared sequence controller accumulates each technique's step distance. It
extracts the forward translation already baked into the pelvis so recovering a
clip cannot pull the actor backward. Review callers apply this root travel; the
game's authoritative movement, input, damage and hit clocks are unchanged. The
main Lab converts the same travel into the displayed model's scale, including
body variants. Its in-place option cancels forward pelvis travel.

Explicitly authored sword plants can enter contact even at high approach speed.
Height, reach, lift-off and discontinuity guards remain active. Release offsets
continue to affect the leg after unlocking, preventing a pop when a foot lifts.
Unlabelled locomotion retains its existing speed/debounce classification.

## Review modes

- `?mode=sequence`: the existing 30-second route with five phrases, now 29 attacks.
  Approach/retreat segments connect to the accumulated attack travel; walk/run
  phase follows the resulting distance. The sequence ends back at its origin.
- `?mode=combination`: slash → back → uppercut → slash → back → thrust → heavy.
  Seven cuts occupy 2.6618 seconds inside the four-second review window. Existing
  `?mode=flow` links still resolve here.
- `?mode=baseline`: the same seven improved techniques with complete recoveries.
  The review window expands to include every cut; this is not an old build.
- `?mode=single`: the five existing techniques, individually selectable.

The reference excerpt (original 2.5–6.5 seconds) can play alongside the first four
seconds of a short comparison, with quarter speed and frame stepping. The camera
follows horizontal pelvis movement while keeping its height fixed, preserving
visible crouches/rises and the blade framing as the character advances.

## Iteration evidence

The original 33.297-second upload was inspected in cropped contact sheets,
including 2.5–4.5 seconds at 12 fps and early/later phrases at 6 fps. The reference
shows deep loading, rising cuts, large directional changes and continued advance.
Its effects obscure some contacts; hidden foot/joint positions were not inferred
as measured ground truth.

| Correction pass | Finding and response |
| --- | --- |
| 1 | Reauthored the five existing cuts with distinct pelvis, torso, hand and foot keys; inspected actual skinned meshes from side and three-quarter views. |
| 2 | Poses remained stationary in the sequence. Added step travel and reduced uppercut back extension. |
| 3 | Connected seven cuts at native speed and expanded the 30-second phrases to 29 cuts. Detected backward pelvis recoil during joins. |
| 4 | Extracted baked forward pelvis motion from root travel; removed the backward join pop. |
| 5 | Detected skating during fast planted phases. Accepted explicit plants and applied the existing release offset during lift-off. |
| 6 | Removed the remaining authored-contact debounce delay while retaining height/reach/discontinuity guards. Inspected final short and 30-second meshes. |

Final display checks also found blade cropping with the old fixed camera after
larger steps. Horizontal camera follow fixes this without following pelvis height.
The Lab adapter now handles X/Z display scales separately.

## Verification and limits

- `node --test apps/rinne/tests/authored-slash.test.mjs apps/rinne/tests/sword-sequence-viewer.test.mjs`:
  nine tests use the real Shino VRM and shared runtime. Checks include unchanged
  combat timing, sockets, moving planted-foot drift, all hit windows, repeated
  techniques, 30-second joins, Lab normalized-to-raw pose/travel parity, contact
  guards, and actual viewer handlers for load/play/seek/speed/reference/modes.
- At 120 Hz, maximum backward pelvis increment during the short moving sequence
  is 0.000526 m; planted toe drift is below 0.000000066 m. The minimum blade-tip
  height across all five individual cuts is 0.135 m. Maximum socket error is
  below 0.000000132 m; the 30-second boundary blade jump is below 0.00412 m.
  These diagnose continuity and attachment, not artistic quality.
- Captured 121 short-sequence frames and 901 full-performance frames at 30 fps
  from the actual skinned mesh. Inspected side/three-quarter contact sheets,
  including standalone thrust and heavy, after comparing the source footage.
- CPU rendering uses source textures with simplified lighting. It does not
  verify browser WebGL/MToon appearance, device frame rate, cloth collisions,
  or frame-exact reconstruction of the reference. Those claims are not made.
- `npm run build:review` passes focused playback/asset/retarget checks, build and
  static asset validation. No new heavy CI or browser gate is added.

Optional visual reproduction (Node, Python 3.10+, numpy, Pillow and numba):

```sh
node apps/rinne/scripts/capture-sword-sequence.mjs /tmp/rinne-short combination
python apps/rinne/scripts/render-sword-flow.py /tmp/rinne-short three --follow --all
python apps/rinne/scripts/render-sword-flow.py /tmp/rinne-short side --follow
node apps/rinne/scripts/capture-sword-sequence.mjs /tmp/rinne-performance performance
python apps/rinne/scripts/render-sword-flow.py /tmp/rinne-performance three --follow 96 105 118 132 225 243 261 369 384 399 579 600 753 774 795
```

The renderer retains its historical filename; it renders actual mesh captures.
Generated frame buffers and visual evidence stay out of the deploy bundle.

## Publication scope

Use `work/visual-review-lab-v2`, existing Draft PR #23, and the dedicated
`rinne-visual-review` Worker. No develop/main merge, Production promotion,
workflow/control change, or separate PR #133 integration is included. Follow the
latest execution policy's single short post-push status check; do not wait/poll CI.
External smartphone delivery remains unconfirmed; no destination is inferred.
