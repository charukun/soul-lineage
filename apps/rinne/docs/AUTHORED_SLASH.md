# Shino: authored whole-body slash

## Scope and visual acceptance

Reference: user-supplied `1000003098.mp4` (33.30 s), reviewed 2026-09-13.
Use its readable weight transfer, leading pelvis, delayed chest/weapon, rapid cut,
and balanced follow-through as a quality target. It is visual reference only;
no source animation, model, footage, or game rules are imported.

First delivery: an individually authored sword slash on the existing Shino rig,
using the current game's attack/contact clock. Review at normal and quarter speed,
with effects off, from front/side/three-quarter views. Preserve input, progression,
techniques, combat windows, saves, existing VRM metadata and other weapon motions.

Acceptance requires visible planted support, a readable load/cut/recovery silhouette,
continuous entry/exit, and a blade crossing that agrees with the existing contact
phase. Validate on the actual rig and in the existing simulator, recording specific
remaining defects; numeric tests alone do not establish reference-level quality.

Implementation and focused validation belong to the work PR. Integration owns
develop integration, CI and DEV publication. Main/Production are outside this task.

## One-tap review

Open Character Workshop (`characters.html`) and tap **斬撃モーションを確認**.
`simulator/motion-review.html` loads Shino and loops this slash immediately.
Pause, restart, 1/2 or 1/4 speed, a seek slider, 60-fps frame steps, orbit/zoom,
and front/side/back presets are available without selecting an actor or technique.
The viewer imports `HumanoidRuntime`; its timing constants are checked against
the game entry definitions by the focused test.
The review sword uses the existing blade dimensions with simplified hilt geometry.
Only Shino's sword/slash takes the authored path; other models and techniques keep
their existing motion. The common solver's explicit knee pole is opt-in.

## Verification record — 2026-09-13

- Loaded the shipped `SHINO_review.vrm` and real retargeted clips in Node; only
  texture decoding was stubbed for the CPU rig test.
- Sampled 121 frames through the production runtime: finite transforms, forward
  knees, closed-loop blade/hips, unchanged active/contact timing, and faster cut
  than anticipation. Maximum grip error: 0.000000119 m. Planted lead-toe drift
  during phase 0.49–0.70: 0.00188 m.
- Inspected textured CPU renders of the actual skinned mesh from front, side and
  three-quarter views. Corrected inverted knee bends found in the first pass,
  widened the stance, deepened the load and shortened the empty-hand reach.
- [Three-quarter poses](evidence/shino-slash-three.jpg) and
  [side poses](evidence/shino-slash-side.jpg) show the corrected motion. These are
  offline software renders, not screenshots of the WebGL viewer. They omit the
  runtime's MToon lighting/outline rendering and are not a GPU appearance gate.
- The available browser reported `GL_VENDOR=Disabled`, `GL_RENDERER=Disabled`
  and could not create a WebGL context. Local preview navigation was also blocked.
  Pixel Fold appearance, browser controls and actual DEV rendering therefore remain
  for Integration's focused browser gate and the user's one-tap visual review.
- Reference-level quality is a visual acceptance decision; no numeric test or
  offline pose sheet establishes parity with the reference game footage.

Integration review route: workshop button → automatic looping slash → pause and
seek → 1/4 speed → front/side/back → return to workshop. Check narrow portrait
framing, no clipped blade, frame controls, load/retry, and return navigation.

## Bounded Motion Warp acceptance

The next runtime improvement preserves the authored `.66 s` slash, active/contact
window, planted-foot correction, weapon sockets and damage authority. It only fixes
the spatial approach into the existing strike.

- lock one valid target when the slash starts; do not home toward a moving target
  every frame;
- controller/gameplay owns `actor.x`, `actor.z` and `actor.yaw`; the humanoid renderer
  remains presentation-only and must not become a second transform writer;
- finish facing the locked target before the main approach, then move only inside a
  bounded pre-contact window and stop adding warp at contact;
- never back away from an already-close target to manufacture animation space;
- clamp approach distance so a distant enemy cannot cause a teleport or replace the
  existing movement/range rules;
- cancel/reset warp when the attack changes, target becomes invalid, actor is
  incapacitated or recovery hands control back;
- multiplayer authority remains unchanged: this is deterministic local/controller
  movement derived from the same attack state, not a new network authority.

Focused tests must cover near/already-in-range targets, bounded far targets, target
locking despite later target movement, turn-before-approach ordering, exact stop at
contact, cancellation, determinism and unchanged slash timing/contact constants.