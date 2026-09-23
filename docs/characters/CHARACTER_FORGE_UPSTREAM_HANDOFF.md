# PR #1524 upstream Forge recovery

## Status

BLOCKED by the pinned upstream material correction ceiling; PR stays Draft. This is a recovery record, not a character acceptance
report. Do not mark Ready or merge this branch from the installation smoke result.

- PR: https://github.com/charukun/soul-lineage/pull/1524
- Branch: `work/character-forge-upstream-20260923`
- Recovery-start develop: `0a7eb58151a83214b505f8b8390006b5a509e40d`
- Recovery-start work head: `1afc2eb7f726201b0f16d44de1de70971a5641e5`
- Original last task run: https://github.com/charukun/soul-lineage/actions/runs/35794189103
- Installation repair: `bc3bfe49f2de6a29972aa70f753bd193cd16de09`
- Installation repair hosted result: https://github.com/charukun/soul-lineage/actions/runs/35804682954

## What actually stopped

The original three commits added five files. The last task run succeeded at
source/dependency materialization and archive publication. `specialist.mjs`
reported `notVisualValidation: true`; it did not invoke a character reconstruction.
All three ordinary Astra validation runs were skipped. No PR discussion supplied
a later model, blocked stage, or continuation. Repository evidence therefore
locates the stopping point; it cannot establish why the prior chat stopped.

Executing the existing workspace installer against the exact downloaded upstream
reproduced `KeyError: 'id'`. The pinned plugin manifest has `name: character`,
whereas its domain declaration has `id: animated-character`. Harness contract
section 6 requires the registry id to equal the manifest **name**. The repair uses
that name and the documented version/repo/ref/resolvedSha registry fields. No
upstream source, pin, algorithm or gate changed.

`verify_upstream.py` runs the real pinned `state.py init`, `state.py status`, and
`next.py`. It checks the animated-character steps, rejection of out-of-order rig
binding, and preservation of pending work on resume. This is installation/state
boundary evidence only.

## Adapter target decision (resumed with user authorization)

The user accepted reuse of the active common RINNE contracts and shared additions
where a contract is missing. The earlier name-resolution blocker is resolved:

- Rig: `KAYKIT_RIG_ID` / `Rig_Medium` and the provider-neutral humanoid mapping in
  `packages/rendering/src/kaykit-rig.js`. Fit joint positions to the reference;
  do not reshape the reconstructed mesh to the imported KayKit body.
- Morph: the existing polish expressions `neutral`, `blink`, `smile`, and
  `mouth-open` in `packages/characters/src/production-pipeline.js`, with a shared
  geometric glTF target adapter in `character-expressions.js`. Zero weights must
  preserve the frozen reconstruction exactly.
- Sockets: preserve the existing RINNE hand/equipment/held-item/talk definitions
  and aliases consumed by Character25D equipment and Character Package actors.
  Equipment calibration remains owned by `runtime-equipment.js`.

This decision does not approve a model, waive rig gates, or lower likeness
requirements. Upstream reconstruction and visual correction must proceed before
rig binding. The following inventory records why a shared addition was needed.

### Original inventory

The request requires existing **Golden Rig**, **Golden Morph**, and **Golden
Socket** contracts and forbids introducing a Forge-only replacement. No declared
mapping from those requested names to an active repository target was found in
the inspected contracts, packages, current tree paths, or model.

Known, distinct repository contracts:

| Path | Observed contract |
| --- | --- |
| `docs/characters/KAYKIT_FOUNDATION.md` | Active foundation is KayKit `Rig_Medium`; it does not identify itself as the requested Golden contract. |
| `apps/character-studio/tests/character-review-rig.test.mjs` | Character Workshop resolves the KayKit humanoid bone contract. |
| `packages/assets/characters/forge/golden-base-boy-v1/manifest.json` | Candidate uses `rinne.forge.humanoid.v1`, `visualApproval: pending`, `productionReady: false`. |
| `packages/assets/characters/forge/golden-base-boy-v1/build/character.glb` | 16 meshes, one skin, 20 joints, ten clips, **zero morph primitives and zero morph target names**. |
| `packages/assets/forge/sockets.py` | Existing Forge hand/equipment aliases; no declared Golden mapping. |
| `packages/characters/golden/README.md` | Golden **performance baselines** derived from approved RUNTIME_READY assets, not a rig or morph schema. No `.golden.json` baseline is present. |
| `docs/characters/MASTER_CHARACTER.md` | Historical Shino rig/expression contract; active reuse is retired by `CHARACTER_LICENSE_POLICY.md`. |

`audit_targets.py` records a tracked-text search, the actual GLB inventory and the
source SHA in `adapter-target-discovery.json` on the hosted task runner. A name
search cannot prove the meaning of an undocumented alias. Consequently none of
the above is silently relabelled as Golden.

**Resolution:** the mapping above is now explicit. Contract naming is no longer
a blocker. Real geometry, skinning, morph deformation and visual parity evidence
are still required; installation success is not completion.

## Pinned engine findings that the implementation must preserve

- img2threejs: `6e60b5e22419464b4853e01ddb6c0e6f6659a733`
- plugin-character: `d8750638f9fc092714e7fcb4941053514455295d`
- img2 harness: `7aa41b37ee24dde844390bb05eca76b709e91599`
- `extract_landmarks.py` emits guides/placeholders; its generic guide lines are
  not observed measurements. Character authoring must fill measured anatomy.
- `humanoid_proportions.py` is the reference-free canon route and refuses a
  reference-backed spec. Do not substitute it for landmark fitting.
- `solve_camera_pose.py` exposes a numerical correspondence fitter as a Python
  API; the simple CLI emits an initial camera guess, not a solved camera.
- `delight_albedo.py` performs actual pixel de-lighting.
- `bake_projected_texture.py` explicitly emits a **descriptor only**, not baked
  pixels. Implement and prove the runtime projection/bake described by upstream;
  do not claim the descriptor is an albedo texture.
- `visual_hull.py` actually intersects front/side/top silhouettes, up to a 32-cell
  grid. Back is not a third independent axis. The hull is an upper shape bound,
  not the final facial/character surface or evidence of unseen concavities.
- `mesh_reference_compare.py` compares two meshes using feet/height alignment,
  band widths/depths and centroid offsets. It does not turn a source image into
  an authoritative reference mesh.
- `orchestrate_passes.py`, `append_review.py`, `next.py`, the turntable,
  multi-angle and part-coverage gates retain authority. No automatic approval.
- plugin-character's freeze/bind/parity order remains mandatory. Its rig gate
  reports unmeasured checks as errors; some upstream producers are absent. Never
  manufacture passing inputs.

## Outstanding implementation and acceptance

Current hosted progress (not final acceptance):

- Original Scout front/side/back pixels: upstream admission, measured landmark evidence, numerical camera fit, approximate de-light and front/side visual hull executed. Back remains surface evidence, not a third axis.
- Strict ObjectSculptSpec and exact upstream SDF/capsule/lathe generation executed. No custom loft participates in this authoring path.
- Two rejected blockout rounds are immutable fixture review records with source heads, capture hashes and actual gate failures. Upstream state retains both refinements (2/6 total).
- Blockout at `cbf7ec6268d4cbef6950064aeffa012b454477e4` passed front/side/back Tier-1 diagnostics: silhouette IoU .9536/.9031/.9197. The agent accepted macro proportions only, with detached nose/arm seams/hem intersections explicitly pending in structural-pass. Hair scalp exposure was zero; turntable and part coverage ran.
- `d8a6704c5b131087551123abbab0d6916599ec9b` replayed that review only after exact factory and six capture hashes matched, then entered structural-pass through upstream state. Nose connection and arm shafts were authored using unchanged upstream geometry. Structural captures passed Tier-1 (.9540/.9091/.9202). The agent inspected front/side/back and both three-quarter captures, accepted connected nose/arm structure, and explicitly rejected final form acceptance until the trouser caps stop intersecting the tunic hem.
- The next form recipe contracts only the hidden proximal trouser caps and increases the unchanged upstream head/hair SDF sampling. Fresh form captures and an agent review remain mandatory. Approved workspaces cannot be reseeded, and the fixture's synthetic blended views are now explicitly labelled generated rather than observed.
- Evidence: https://github.com/charukun/soul-lineage/actions/runs/35811219707
- Form capture at `4b4298bea500ec6404390bb3f0b37f19db8d7377` removed exposed trouser-cap intersections. The agent inspected all three comparison sheets and both three-quarter views and accepted shape for projection, not final likeness. Front/side/back IoU .9540/.9089/.9202. The exact factory/capture hashes are in `upstream-scout-form-r0-review.json`. Evidence: https://github.com/charukun/soul-lineage/actions/runs/35812184764
- Material adapter checkpoint: full-view de-lit pixels, independent upstream PBR estimates and foreground masks feed the actual Three.js GPU bake. The pinned `bake_projected_texture.py` directly supplies descriptors; it explicitly does not bake pixels, so camera-space depth/normal visibility and UV rasterization are supplied at the documented runtime boundary. Per-texel provenance masks distinguish observed, interpolated, mirrored and inferred samples. UV chart duplication is checked against accepted positions/normals and happens before plugin mesh-freeze. Runtime execution and visual acceptance of this new bake remain pending.
- Divine Eye colour/interior ensemble remains low-confidence for clay. This is not a final likeness score, a finished projection, or Quality Floor approval.
- The first actual GPU bake at `f4a632039c07af92c90b6fd4970c353312a64c2e` emitted textures and a 36.8 MB raw GLB, but material acceptance failed. Side/back colour deltas exceeded the unchanged 20.0 gate (20.44/22.10). Per-mesh bake evidence exposed zero rasterized texels for neck/head/hair: world-space frustum culling had incorrectly discarded UV-space draws. The correction disables that inapplicable cull and rejects zero-texel atlases. `material-r0-review.json` records a third upstream refinement (material 1/3, total 3/6); no AI acceptance or Quality Floor success is claimed. Evidence: https://github.com/charukun/soul-lineage/actions/runs/35812947481

Outstanding: material/surface/lighting/interaction/optimization acceptance; final projected likeness; rig/morph/socket adaptation and parity; final package/registry/Lab model; DCC if needed; visual regression; focused build and native browser evidence on the reconciled final head; Ready, develop merge and DEV start.

The old `pipeline.py` loft route is deprecated and disabled without an explicit
legacy compatibility-test flag. The default CLI enters `upstream_workspace.py`.
Three local entrypoint/legacy compatibility tests passed; hosted verification is pending.
Character25D, current character runtime,
Camera Director, normal Fast DEV and Production gates are unchanged.

The branch-only specialist workflow is still needed for continuation. Remove it
before constructing the eventual mergeable final tree. Do not create a replacement
branch or PR. Keep all subsequent evidence bound to the actual current model/head.

## Material correction and review integration checkpoint

At `438843ca09d826af6d1e6a6a9f7bea5fff4ed9b4`, all meshes produced nonzero UV rasterization and accepted position/normal parity remained exact. Side/back colour gates still failed (20.17/21.89). The next counted correction uses neutral inferred diffuse illumination and an independently extracted blue-back recipe; the upstream gate and threshold stay unchanged. This is material refinement 2/3, total 4/6, not acceptance. Evidence: https://github.com/charukun/soul-lineage/actions/runs/35813707448

The Lab adapter now accepts calibrated img2threejs camera data through the existing Camera Director authored-shot path, preserving projection on differently shaped viewports. Geometric expression validation rejects empty/nonfinite targets, and optional package expressions plus both three-quarter views have controls. Five focused local camera/morph tests passed; no bound model or native browser acceptance is claimed yet.

## Authoritative material hard stop

The material capture at `ce6b54e9cb5c5e1487d82cf27994e4616ff52f3e` passed all three Tier-1 gates (front/side/back IoU .9542/.9086/.9202, colour delta 10.80/8.16/7.78). Divine Eye reported low-confidence/probe with no hard geometric failures. The agent then inspected all three comparison sheets, both obliques, neutral and grazing captures. **Rejected:** strong black speckles and vertical seams, contaminated hands, and missing rear hair length. Numeric passes do not override that visual failure.

The actual upstream `append_review.py` records material rejection r2 with action `refine-code`, score .62 and failed critical features. `next.py` returns **3** with `max-correction-loops-reached:material-pass:3/3`; total corrections are **5/6**. The unchanged upstream `forge/_shared/workflow_state.py:sync_from_spec` stops when the current pass count is >= its limit. `SKILL.md` requires reporting the stop and requesting input. State, complete spec and rejection are retained under `docs/characters/qa/forge-upstream-blocked/`. Never reinitialize this Scout workspace or silently increase the limits.

Evidence: https://github.com/charukun/soul-lineage/actions/runs/35814971440 ; artifact 10731326124, SHA-256 `feb41171b45b458639338500cc236aa220f3577395d4f4f576730d18dc71ff04`. The branch-only specialist now audits the saved stop and source changes; it does not regenerate this stopped subject.

Tried: exact upstream intake/spec/factory/hull; initial browser export repair; two blockout corrections; structural and form acceptance; actual camera/de-light/PBR/GPU projection; material UV-frustum repair; neutral illumination and independently observed back recipe; required deterministic and actual agent visual comparisons. Local browser execution was unavailable, so all actual captures used the hosted runner. DCC repair, rig binding and later stages have not been executed: continuing the reconstruction through a different tool would bypass the now-triggered mandatory upstream stop.

Concrete resume condition: obtain an explicit user decision resolving this upstream hard stop before another reconstruction/DCC iteration. Keep this history and branch/PR. Then diagnose UV chart gutters/raster coverage and per-part projection ownership, use repository Blender refinement if required, and re-evaluate all views without changing acceptance thresholds. The current output is not acceptable for merge.

Prepared but not actual-character validated: `upstream_rig.py` directly calls pinned plugin geodesic binding, rigid-role partitioning, proximity conditioning and payload validation; `three_rig_adapter.js` performs RINNE attachment and Socket transport; `upstream_morph.py` directly calls the pinned upstream morph delta builder. A transformed-mesh test proves neutral buffer preservation and joint rotation, but no actual Scout binding, geometric expression set, rig gates, native Lab package or Quality Floor is claimed. The old integrated factory uses envelope weights while the pinned plugin requires geodesic binding; the adapter uses the plugin directly. Its prescribed mesh-export helper is absent from all three pinned trees, so buffer transport is supplied by the Three adapter with upstream freeze/parity as authority.

## Authorized continuation, 2026-09-23

The user explicitly delegated resolution of the reported stop: 「あなたの判断で解決して進めて下さい」. `upstream-scout-resume.json` records the scoped decision: material limit 3 → 8, total 6 → 18, preserving all five corrections and eight review entries. This is one bounded migration for the hash-bound stopped Scout state, not an automatic stop bypass or changed default. The unchanged pinned state validator, synchronizer, atomic save and `next.py` confirm active material reconstruction at 3/8, total 5/18. No quality threshold or upstream source changed. The old stop snapshot remains historical evidence.

Continuation-start develop is `d6e59d460b86d7f49e5d4f5e4286a16945573df2`, PR head `6e9d48a3230fd79356f000fcd91110e19d3b32b4`. The task runner restores the actual ce6 artifact with exact archive/source/factory hashes, retains accepted geometry and executes the changed GPU adapter. It does not regenerate the factory during a refine-code iteration. The artifact is temporary task compute input, not the final package's permanent dependency.

UV chart repair extends actual rasterized texels only inside their own chart cells and checks bilinear support along every triangle edge. It leaves accepted shape, observed source pixels and original provenance masks unchanged. Two targeted tests cover fractional chart boundaries, neighboring color isolation and a missing-chart failure. Actual rerender and visual review are still required; this checkpoint is not Quality Floor acceptance.

Material r3 at `6e673d946faf01c8a5ac424939f9f098cdd0bbac` executed successfully on hosted run https://github.com/charukun/soul-lineage/actions/runs/35817352466 . All 28,210,176 atlas-edge bilinear tap checks had support; all three Tier-1 diagnostics passed (IoU .9542/.9086/.9202, maximum color deltas 11.42/10.45/10.82). The agent inspected FSB comparisons, both obliques, neutral and grazing and still rejected material (.74): cross-part projection contamination, boundary speckles and artificial grooves remain. Real upstream history now records material 4/8, total 6/18.

Next adapter correction uses observed source-surface masks for this independently drawn flat-color fixture and requires full foreground filtering support. It preserves source/de-lit albedo and all extracted physical evidence. Because the illustration supplies no observed physical relief, inferred luminance-based height/normal/AO are retained as evidence but are not applied as grooves; actual geometry and matte lighting still supply three-dimensional shading. Other characters require their own reviewed segmentation/material interpretation, never this fixture's palette. Visual acceptance remains pending.

Material r4 at `f58c9c85a919aa68491ed039d3ced91ba675b49a` / https://github.com/charukun/soul-lineage/actions/runs/35817940713 ran 11 focused tests and actual projection successfully, but failed side/back color gates (boot delta 23.23/25.98) and agent review. Part masks removed cloth-on-hand contamination. The diagnostic albedo-only ablation did not remove grooves and cannot be used for pass acceptance. RGB atlas inspection found bright pixels absent from every owned source texel; automatic source mipmaps mixed background while the ownership mask sampled level zero. The next correction disables implicit source mip selection for the bake, tests every owned texel against its source color bounds, uses the four neighboring foreground depth samples for raster visibility, and restores all independent PBR maps.

The original flat-fill fixture has no illumination (its authoring source proves this). Execute upstream delight_albedo.py with its documented strength=0 passthrough and verify exact source/output RGBA parity, rather than normalize its color regions as shadows. This decision is Scout-specific, explicit in spec and receipts, and not a new default for photographic references. No upstream code, pin, threshold or correction history is changed.

Material r5 at `00e3bea2c9ad311c281740ead920de979c2b1fe9` / https://github.com/charukun/soul-lineage/actions/runs/35818713998 removed the severe longitudinal color streaks while applying all independent upstream PBR maps. Every owned texel passed source-range checks; front/side color deltas improved to 5.3/6.3. Back still fails at 21.9, and actual agent review rejects the front-teal continuation blocks on the back and hair covering too much of the side face. The next counted action is refine-spec (material 6/8, total 8/18).

The next geometry edit is authored upstream SDF data only: a rotated-box side-face boundary fitted to observed pixel corners [104,53] and [94,91], intersected with the unchanged front-hairline opening. Upstream performs all primitive evaluation, intersection, subtraction, generation and scalp gating. A local strict-quality preflight has zero errors/warnings; visual confirmation remains required. Unobserved texture continuation now uses the independently measured modal surface color in each view, retaining inferred provenance rather than using front teal on the back.

### Material r6 actual review / next correction

Run 35819329523 at a3364890b93be9ccf3c0dee2d69a06490f9bb857 succeeded. All FSB Tier-1 checks passed: silhouette IoU .9540/.9086/.9199 and maximum color delta 5.30/5.83/8.13. All eight actual captures and FSB comparisons were inspected. Visual acceptance remains rejected (.82): the side-face SDF cut retained lateral hair slabs, and camera-visibility renormalization made color islands on the rear oblique. This checkpoint widens only the source-authored sagittal clipping volume, preserves exact upstream SDF/scalp semantics, keeps absent cameras as explicitly inferred directional continuation, and increases triangle chart density according to solved-camera source pixel spans. Flat constant-color owned surfaces retain existing sampling allocation. Source images, pins and thresholds are unchanged. Material counter becomes 7/8, total 9/18; no history reset. The next actual hosted render must be reviewed before acceptance.

### Material r7 review and controlled diagnostic stop

Run 35820510064 / fe89d28829fb86bc9c739c3461188528e5aa54a7 completed. All eight images inspected: side hair slabs and color islands improved, cap rim and fine belt/emblem artifacts remain unacceptable. FSB Tier-1 (IoU .9450/.9086/.9132), turntable/scalp pass; actual visual rejection (.83) stands. This checkpoint captures unlit albedo from the exact GLB and records real 8/8 stop; no new geometry is built past it. Delegated user judgment remains available for a subsequent bounded hash-bound DCC/diagnostic correction budget; preserve every review/counter. Existing Blender scripts/audit path is the next geometry refinement route. Final Quality Floor, Rig/Morph/Lab/merge remain incomplete.

### Exact GLB albedo diagnosis and bounded DCC correction

Diagnostic run 35821297960 / b769504147079e04fbc7a46239e2730ff6049caa captured the same artifacts with unlit MeshBasicMaterial; physical lighting is not their cause. The run then obeyed the genuine upstream stop at material 8/8, total 10/18. The preserved artifact is 10733586924. CPU projection of the actual triangle/UV buffers at pixel (247,540) samples gold RGB [220,183,97], while the actual MSAA output is [177,177,117], a 3:1 gold/teal mixture. This identifies fragment-center interpolation extrapolating outside skinny triangle charts; bilinear edge support alone did not cover that footprint.

The next checkpoint tests centroid UV interpolation on that unchanged GLB, retains it as explicit GLB material metadata and applies it through the shared Forge actor. It neither edits source pixels nor changes the upstream mesher. A hash-bound delegated decision resumes exactly the recorded state at material 8/12, total 10/22, preserving all reviews and the old stop. Four extra corrections are specifically bounded to this diagnosed rendering defect and the requested DCC refinement. No score/threshold/pin changes.

Blender imports the actual upstream-generated buffers and source textures, welds coincident hair chart vertices before rig freeze, pulls only the observed forehead band toward the real head surface with explicit inferred clearance/displacement limits, then relaxes that band. Other geometry is untouched. The editable packed blend and existing production audit are retained; no pre-rig audit is misrepresented as rig acceptance. Browser reprojection, scalp checks and all reference comparisons follow DCC. Surface-pass authoring is prepared but cannot execute until actual material acceptance.

### Centroid proof and actual Blender execution

Run 35822189434 / ac2e0456a622d6ca43fb23e0461d9a59e353782c proved the cause on the unchanged exported GLB: at pixel (247,540), unlit RGB changed from [177,177,117] to the observed [220,183,97] solely through centroid interpolation. Actual front/back/front34 diagnostic images were inspected; the face, belt and emblem speckles/lines disappeared. This is sampling proof, not full character acceptance.

Blender 4.0.2 actually refined 4,378 hair vertices, maximum displacement 0.033559m, and saved a packed editable blend plus output mesh SHA e56a002ba4fb8c4b55e1fd3291067868869016c4523764084b292088cb1654c0. Existing production audit correctly reported 17 meshes with UVs, applied transforms and valid polygon checks, but no armature at this raw pre-rig stage. Its nonzero exit prematurely stopped the task before browser reprojection. No audit was weakened: the recovery validates only raw geometry transport, keeps productionAuditPassed=false, retains the expected unmet singleArmature check and all downstream rig gates, then resumes the same actual DCC artifact for browser/reference/scalp comparison. State is active material 8/12, total 10/22.

### Material r8 rejected after actual DCC browser review

Run 35822583356 / 7ad07cb1d41e1403392270c70106b207259949f1 completed, but all eight images and FSB comparisons show an unacceptable collapsed/speckled hair rim. Front/side Tier-1 pass; back color fails 21.85 > 20. Centroid corrected the independent atlas defect, but did not solve this new DCC topology defect. Actual rejection is .82; material count becomes 9/12, total 11/22. No quality gate or limit changes.

The next Blender correction returns to the retained original pre-DCC upstream-generated mesh, limits pull to 60% (preserving thickness), then repairs intersecting sheets through Blender voxel remeshing at 0.65 observed-source pixels. Surface-distance bounds are checked before new projection, scalp and FSB/oblique comparison. This is pre-freeze topology repair of the actual generated hair. Other geometry and every source pixel remain unchanged. Back color still requires an actual passing diagnostic; no override is authorized.

### Material r9 and missing per-part diagnostic regions

Run 35823791541 / de95ca4cc714deccb3a2fef08a0aae549616ba9b completed. All eight actual images and FSB comparisons inspected: the speckled forehead band is resolved by actual Blender voxel repair, while the cap silhouette/source-conflicting rear hair still need an honest final likeness decision. FSB IoU .9448/.9087/.9129; front/side color pass, back global color remains 21.85. Material remains unaccepted, state 9/12, total 11/22.

The pinned diagnose_render.py explicitly documents that per_part_color_delta actually clusters the entire image into at most five colours; it has no per-component render regions. A diagnostic crop of the actual rear boot produced delta 3.35 with that same unmodified function, compared with the global report of 21.85. The next checkpoint captures actual GPU part IDs, isolates each visible part of the same beauty render, and calls the unchanged upstream function on every measurable component in every required view. Original global reports and all state/acceptance gates remain unchanged. This is causal evidence gathering, not an override or a new acceptance.
