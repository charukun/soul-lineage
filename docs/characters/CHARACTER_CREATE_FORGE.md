# Character Create Forge

`Character25D` is the independent raster/2.5D representation route. Character
Create Forge is an original procedural 3D candidate pipeline. It does not replace
either Character25D or the current RINNE protagonist. Generated candidates never
receive human approval, Character Production promotion, or Production adoption.

## Astra execution

For 「この三面図を元にCharacter Create Forgeを使ってキャラモデルを追加して」:

1. Read latest develop / AGENTS and this instruction. Check existing package id,
   source rights, Character License Policy and the current Character View.
2. Place eligible original images and `provenance.json` in the source workspace.
   Prefer front/front34/side/back34/back; front/side/back is recommended. One front
   image is an explicit lower-information fallback. Do not discard supplied views.
3. Inspect the image. Flat background/transparent, upright full-body neutral pose
   is the automated MVP domain. For a sheet, check left-to-right semantic order;
   `--sheet-order back,side,front` can label regions without user crop coordinates.
   Ambiguous region counts fail closed. Astra separates/labels references when
   necessary; never ask the user for crop pixels, UVs, weights, or mesh parameters.
4. Use Python 3.10+ and the pinned `packages/assets/forge/requirements.txt` in the
   authoring environment, then run the CLI. No paid provider or credentials.
5. Inspect `pipeline-state.json`, spec, report, and normalized references. Anatomical
   joints/semantic decomposition are hypotheses; never relabel them observed.
6. If hood/hat/cape/accessory semantics cannot be recovered by flat-mask analysis,
   Astra may author `--analysis analysis.json` with `parts` entries containing
   `id`, `role`, `verticalBand:[bottom,top]` (normalized body height), `bone`, and
   `rearOnly`. Geometry widths/depths still come from all supplied views. The user
   supplies character intent, not these implementation fields.
7. The CLI writes a package and regenerates the shared discovered registry. Commit
   those actual generated outputs. Do not add a model import or path to Review UI.
8. Open Lab → Character → Character Create Forge. Inspect front/side/back with
   source images, 360°, texture off, skin deformation, animations and sockets.
   Preserve warnings and report remaining defects. Do not promote on load success.
9. Use exact-head hosted Actions focused tests/builds and the explicit browser
   scenario. Reconcile latest develop, revalidate that head, Ready, merge that head
   to develop in the same task; DEV deploy completion is asynchronous.

## CLI

```sh
python3 -m pip install -r packages/assets/forge/requirements.txt
npm run character-forge:create -- --front source/front.png --side source/side.png --back source/back.png --id scout --name "Scout" --provenance source/provenance.json
npm run character-forge:create -- --front source/front.png --id scout-single --name "Scout" --provenance source/provenance.json
npm run character-forge:create -- --sheet source/character-sheet.png --id scout-sheet --name "Scout" --provenance source/provenance.json
```

Five-view input adds `--front34` and `--back34` to three-view input. `--replace`
allows deliberate replacement of an unapproved candidate; approved ids are
immutable. The mandatory rights record contains `author`, `source`, and `license`
(`RINNE-OWNED` or `CC0-1.0`). Astra derives it from actual authorization/license
evidence, never from model appearance. Metadata alone is not a rights grant.

## Architecture and schema

The fifteen stages in `packages/assets/forge/pipeline.py` delegate to separate
modules. Python/Pillow is an offline authoring adapter. Runtime modules live in
`packages/assets/src/character-create-forge`; the package is a shared asset route.
The existing Lab Character View is currently hosted by `apps/character-studio`.
Its normal canvas, renderer, OrbitControls, shared `positionReviewCamera`, and
`@soul/rendering/camera-director` / `applyCameraPresentation` are
reused. No second application or camera director is introduced.

```
packages/assets/characters/forge/<id>/
  source/original-*                 # original bytes and hashes, never overwritten
  source/{front,side,back,...}.png   # lossless extracted regions
  spec/reconstruction.json
  build/character.glb               # actual skin, clips, joints, sockets, texture
  build/textures/{base-color,source-weights-a,source-weights-b}.png
  review/references/*.png           # normalized comparison references
  review/comparisons/*.png          # exported triangle silhouette diagnostics
  review/thumbnail.png
  manifest.json
  validation-report.json
  pipeline-state.json
packages/assets/generated/create-forge-registry.js
```

`rinne.character-reconstruction/v1` records forge version, reconstruction mode,
source hashes/crops, raw bounds versus normalized measures, per-view landmarks,
body widths, side depths, all silhouette rows, semantic components/materials,
projection regions and texel attribution, inferred/unknown regions, rig/sockets,
assumptions, provenance and validation metadata. `observed` is reserved for sampled
image evidence. A silhouette at an inferred anatomical height does not make that
joint a measured fact. `interpolated`, `mirrored`, `inferred`, `generated` remain
distinct concepts; source weight maps encode which views contribute to each texel.

`rinne.character-package/v1` includes id/name/version, 3D representation, mode,
sourceViews, hashed model, skeleton, real animation list, socket definitions and
legacy aliases, scale/bounds, camera anchors, provenance, review/validation state.
Review states are `generated`, `review-candidate`, `approved`; this CLI only emits
`review-candidate`. The registry only publishes structurally validated packages
with a matching model hash, and cannot grant `approved`.

## Reconstruction

- Modes: front only → `single-view`; three named views → `multi-view`; all five
  → `enhanced-multi-view`. Two or four views and ambiguous sheets are rejected.
- Alignment: foreground extrema define head top/ground, uniform scale normalizes
  height to one, and silhouette center normalizes the horizontal origin. Raw
  images/bounds are retained. An independently inferred neck notch is aligned to the view median with a bounded
  piecewise vertical correction (at most 3.5% height), preserving top and sole. Raw
  and corrected landmarks remain distinct. Named body levels link all views in one
  +Y-up/+Z-front space; other body/face semantic
  landmarks remain explicit anatomical hypotheses.
- Perspective: weak-perspective, isotropic height/ground correction is recorded.
  This compensates minor scale/ground offsets, not large yaw/foreshortening or
  perspective differences. Never claim an optimized camera solve.
- Geometry: closed loft volumes for head/neck/torso/pelvis/limbs/hands/feet, clothing
  and rear hair. Front/back widths and side depth profiles drive ring positions.
  Facial bands use side profile depth, including a nose ridge. Optional semantic
  components support hood, hat, cape and accessories. No image billboard meshes.
- Projection: front/side/back and optional obliques really sample their own pixels.
  Surface-normal weights blend in linear color into a per-component UV atlas with
  gutters. Opposite-side samples are marked mirrored; when no valid source exists the texel is
  neutral and marked generated. Weight-map A RGBA = front/front34/side/back34; B RGBA =
  back/mirrored/generated/opaque. This is real CPU pixel baking, not a descriptor.
- Rig/skinning: RINNE-owned generic humanoid hierarchy, inverse bind matrices,
  four-joint attributes with normalized soft parent-join weights. This is a generic
  rig, not a claim of KayKit animation retargeting compatibility.
- Clips: actual Idle/Walk/Talk/Attack/Hit/Rest/Run/Pickup/Jump/Fall quaternion tracks.
  They are simple candidate motion, not polished mocap, lip sync or foot IK.
- Equipment: shared `createRinneWeapon`, equipment state/calibration and existing
  hand/weapon/secondaryGripTarget/weaponHitboxAnchor/trailOrigin/heldItemAnchor
  aliases. Host still owns damage, inventory and gameplay. `cameraSubject()`
  supplies existing Camera Director/RINNE subjectProvider fields and anchors.

## Evidence and limitations

Run `node --test tests/character-create-forge.test.mjs` for modes, sheet separation,
actual depth changes, texture contribution, skin/clip/export/registry and failure
paths. The original synthetic fixture is `scripts/character-forge/fixture.py`.
It contains no downloaded character images; oblique fixtures are explicitly
synthetic blends and do not assert real photographic reconstruction accuracy.

`tests/character-create-forge-browser.test.mjs` is an explicit specialist scenario,
not an unconditional routine sweep. It checks the shipped GLB in the existing
Character View, native controls, three comparison modes, animation bone deltas,
turntable/orbit/zoom, display toggles and absence of browser errors. Screenshots,
trace, video and a head/hash-bound receipt are written to `test-results/character-create-forge`.

Automated visual diagnostics rasterize delivered GLB triangles using fixed
orthographic front/side/back coordinates. They report IoU/silhouette, height,
head-area/body ratio and ground mismatch. Review captures use the existing shared
camera with a 6° weak-perspective lens. Diagnostics do not prove facial likeness,
intersections, invisible concavities, hand topology, animation polish or physical
mobile performance. Reference lighting is not removed; occlusion-aware texture
visibility and semantic segmentation are limited. The candidate pipeline's numeric
threshold is diagnostic, not a replacement for art approval or DCC promotion.

The authoring scaffold compensates for absent multi-view model generation in the
runtime. Dependencies: Python/Pillow, Character Package, shared rendering and
equipment. It can be detached when another reconstruction backend produces this
same audited package/schema and passes the same evidence, without changing games.

Prohibited: drop side/back; billboard-only geometry; fake clips; hand-register UI
paths; infer rights; silently approve; replace Character25D; change normal game
state; introduce a second camera director; weaken validation or Production gates.

Reference comparisons submit an authored cut to the shared Camera Director (now on develop via PR #1490); the package camera subject supplies bounds, head/body/focus/ground anchors. Interactive orbit remains the existing Review control. No Forge camera director is implemented.

For evidence of a newly created package, run `CHARACTER_FORGE_ID=<character-id> node --test tests/character-create-forge-browser.test.mjs` on its exact head. The default id is the original synthetic fixture; the same native controls and assertions apply to other discovered packages.
