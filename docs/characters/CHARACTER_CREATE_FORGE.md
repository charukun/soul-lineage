# Character Create Forge

Character Create Forge uses the exact pinned img2threejs reconstruction workflow.
RINNE owns source transport, runtime baking where upstream supplies descriptors,
Golden contract adaptation, packaging and runtime integration. Character25D is an
independent route and remains available. Generated characters do not receive human
approval, Character Production promotion, or Production adoption automatically.

PR #1524 is still under specialist validation. Read
`CHARACTER_FORGE_UPSTREAM_HANDOFF.md` for measured progress and outstanding work;
a working entrypoint is not evidence of a completed character.

## Start or resume a character

For 「この三面図を元にCharacter Create Forgeを使ってキャラモデルを追加して」:

1. Read current develop, AGENTS, this contract, source rights and the existing
   package id. Use the same work branch/PR when continuing an existing task.
2. Inspect every supplied image. Prefer Front / Side / Back; retain optional
   front-three-quarter, rear-three-quarter and top evidence. Separate a sheet into
   lossless named views, retaining original bytes, crop coordinates and hashes.
   Never ask the user to supply UVs, weights or reconstruction parameters.
3. Record eligible rights (`RINNE-OWNED` or `CC0-1.0`, author, source) from actual
   authorization. Appearance or an invented provenance record cannot grant rights.
4. Create an upstream workspace, or resume its existing state. Do not reseed an
   approved workspace, reset correction counters, or replace a hard stop with a
   successful-looking legacy model.

```sh
python3 -m pip install -r packages/assets/forge/requirements.txt
npm run character-forge:create -- create --workspace .forge-work/scout --id scout --name "Scout" --front source/front.png --side source/side.png --back source/back.png --provenance source/provenance.json
npm run character-forge:create -- next --workspace .forge-work/scout
npm run character-forge:create -- run --workspace .forge-work/scout --entry forge/stage3_build/generate_threejs_factory.py -- object-sculpt-spec.json --pass-id blockout --out build/blockout.ts
```

`create` initializes inputs and the real `animated-character` state machine; it
cannot honestly finish a likeness-reviewed model in one invocation. `next` is the
workflow authority. `run` invokes the verified pinned Python entrypoint; `mark`
records an actually completed upstream step with its evidence. Every call retains
command receipts. A front-only workspace remains an upstream lower-information
route; the current RINNE multi-view GPU bake explicitly requires Front/Side/Back
and fails when a required view is absent. It never silently drops supplied views.

The lock is `packages/assets/forge/upstream.lock.json`. Materialization verifies
Git tree hashes before execution. Read the materialized engine's `SKILL.md`,
`docs/ARCHITECTURE.md`, `forge/state.py`, `forge/next.py` and the current stage's
implementation. Read the pinned plugin's animated-character and rig contracts.
README-only understanding is insufficient. Do not change pins incidentally.

## Reconstruction authority and stage evidence

- **Intake:** execute upstream reference admission/probe and relevant vision
  adapters. `extract_landmarks.py` produces a scaffold, not measured anatomy.
  Author actual source-pixel landmarks and explicit confidence. Use the numeric
  `fit_camera_to_correspondences` API from `solve_camera_pose.py`; the simple CLI
  initial guess is not a solved camera. Record inferred 3D correspondences as such.
- **Assessment/spec:** use upstream pre-spec assessment, ObjectSculptSpec and
  `validate_sculpt_spec.py --strict-quality`. Fit observed head/body proportions,
  side depth and separate forehead/eye-plane/cheek/nose/mouth/jaw/chin/cranium.
  Reference-free humanoid constants cannot replace these observations.
- **Geometry:** execute upstream `generate_threejs_factory.py` and its existing
  SDF/primitive/lathe generation. Reference-specific profiles are authored spec
  data, not a replacement RINNE mesher. Use real `visual_hull.py` cone intersection
  as an outer silhouette constraint where applicable. Front and Side constrain
  geometry; Back contributes surface evidence and is not a third independent axis.
- **Projection:** run real `delight_albedo.py`, upstream PBR extraction and
  `bake_projected_texture.py`. The last tool is explicitly descriptor-only.
  `three_projection_bake.js` supplies its documented Three.js runtime operation:
  solved camera projection, foreground/depth visibility, UV rasterization and
  baked pixels. Independent roughness/normal/height/AO estimates retain their
  inferred status. No front-only decal or procedural replacement of source identity.
- **Review:** retain blockout → structural → form → material → surface → lighting
  → interaction → optimization. At every important pass build, render, compare,
  diagnose, inspect, refine and rerender. Use upstream diagnostics, comparison
  sheets, multi-angle, turntable, part coverage and review history. Only an actual
  agent inspection may append a visual decision. Exact-capture review replays must
  match factory and image hashes; they cannot approve a changed model.
- **Mesh comparison:** compare feet-aligned, height-normalized widths/depths by
  vertical band and centroid offsets, not just bounding boxes. An upstream hull
  comparison is labelled an inferred constraint, never a ground-truth scan.

Preserve `observed`, `interpolated`, `mirrored`, `inferred` and `generated`.
Material provenance masks and shape measurements are separate evidence. Ambiguous
or inconsistent views stay explicit. Stop on unreadable required views, missing
landmarks, upstream hard stops, unavailable required stages or missing comparisons.
Do not fabricate producer outputs or lower gates to unlock the next pass.

The regression authoring recipe is `scripts/character-forge/author_upstream_scout.py`
with versioned observations/reviews under `scripts/character-forge/fixtures/`.
Those are Scout-specific data. A new character requires its own observations/spec;
copying Scout dimensions would reintroduce the prohibited generic-character path.
The original fixture is independently drawn; its blended oblique convenience images
are generated composites and are not admitted as observed views.

## RINNE boundary and quality

Accept raw reference likeness before binding. Golden Rig means the active common
`Rig_Medium` / provider-neutral humanoid mapping, fitted to the reconstructed shape.
Golden Morph uses common `neutral`, `blink`, `smile`, `mouth-open` expressions.
Sockets reuse the common RINNE hand/equipment/held-item/talk definitions and aliases.
Never reshape the character to a generic rig or create a Forge-only socket system.

Preserve plugin mesh repair → freeze → payload validation → bind → exact parity
→ actual clip measurement → rig gates. Unmeasured gates are errors. Compare neutral
Front/Side/Back and turntable again after rig, morph, export and optimization. Real
motion and nonzero geometric morphs must be visible; names alone prove nothing.

Quality Floor requires a recognizable reference character, retained silhouette and
head ratio, face/outfit identity, actual side volume, credible back and working rig.
If generation misses this floor, use the existing DCC/Blender carrier path described
in `CHARACTER_DCC_CARRIER.md`, correct real geometry/weights/morphs/materials, export,
render in the browser and repeat reference comparison. Opening Blender is not a
quality result. An unproven character remains a candidate.

## Package and Visual Review Lab

Use the existing `rinne.character-package/v1` contract and discovered registry.
Keep original named sources, upstream state/assessment/spec/command receipts/review
history, raw reconstruction, Golden model/textures, provenance, validation report
and hash-bound comparisons. Registration must verify the delivered model hash.
Do not hard-code model paths or imports into the review UI.

The native Lab route is `/review-character-forge`, linked under 専用ビュー.
The selected model must remain the main viewport. Preserve free orbit, turntable,
texture, wireframe, skeleton, sockets, animations, source view selection and direct
comparison/opacity controls. Candidate grids retain five columns, including phones.
Character View and current game actors remain compatible.

Reference reconstruction cameras come from img2threejs. Gameplay/presentation
cameras remain RINNE Camera Director. Evidence must include source/render/comparison
for Front/Side/Back, front/rear three-quarter, turntable, wireframe, skeleton,
sockets and actual animation. A standalone HTML cannot replace the native Lab proof.

Run requested specialist focused tests/build, actual reconstruction and native
browser evidence on the final reconciled exact head. Re-fetch latest develop,
reconcile when required by the task, validate the changed head, Ready and merge that
same validated head to develop. Confirm merge and DEV deployment start; do not wait
for DEV completion. Remove task-only workflows before the final merge tree.

## Deprecated generator

`pipeline.py`, custom loft/depth/projection and `pipeline-state.json` belong to the
legacy generator. They are no longer the CLI default or an upstream fallback.
The old entrypoint refuses execution without `--legacy-regression-only`; that flag
exists solely to test historical package compatibility. Existing packaged candidates
and Character25D are retained. The legacy regression test does not establish any
quality or upstream-fidelity claim for the new Forge.

The wrapper compensates for source/state transport and a descriptor-only GPU baking
gap; it depends on the pinned engine/plugin, Python/Pillow, exact locked Three.js and
Character Package. Remove it when upstream supplies the same executable boundary
without losing state, likeness evidence or runtime contracts. Do not preserve a
second reconstruction engine for convenience.
