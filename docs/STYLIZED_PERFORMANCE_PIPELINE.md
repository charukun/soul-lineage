# Stylized Performance Pipeline

This document extends `STYLIZED_LOW_MID_POLY.md` with the runtime performance and authoring contract implemented after the initial visual-target phase. The GPU/compression/occlusion/DCC extension is specified in `GPU_RENDERING_PERFORMANCE.md`.

## Principle

Performance is recovered from invisible or low-value detail and reinvested into silhouette, motion, lighting and VFX. Gameplay state, collision, network authority and save data never depend on visual quality tiers.

## Authored LOD

Static environment and prop assets may provide sibling meshes named `<name>_LOD0`, `<name>_LOD1` and `<name>_LOD2`.

- LOD0 is the authored near mesh.
- LOD1 is the readable mid-distance mesh.
- LOD2 is the far mesh.
- If an authored lower LOD is missing, the safe bounding-box proxy remains the final fallback for eligible static meshes.
- Skinned/morphed character meshes are never runtime-decimated.

The runtime contract is complete. Individual art assets can adopt authored LOD siblings incrementally without changing game code. `npm run lod:generate` provides a Blender headless path for silhouette-guarded DCC LOD generation; Shape Key meshes fail closed and remain authored-LOD work.

## Adaptive quality

`@soul/rendering/adaptive-quality` exposes four presentation tiers: full, balanced, mobile and survival. `@soul/rendering/gpu-aware-quality` augments the same hysteresis with GPU timer evidence when `EXT_disjoint_timer_query_webgl2` is available, so CPU pressure can preferentially reduce animation/world-density work without needlessly blurring the frame.

Quality tiers may change render scale, shadow resolution, vegetation/set-dressing density, VFX ceiling, texture anisotropy and visual streaming distance. They may not change simulation, collisions, inventory, interactions or network state.

Mobile-class devices target 30 fps; desktop-class presentation targets 60 fps.

## Animation LOD

MasterCharacter production actors share a common distance scheduler:

- Hero/reference: 60 Hz, full expressions and secondary motion.
- Near NPC: 60 Hz.
- Mid NPC: 30 Hz, or 24 Hz under heavier quality pressure.
- Far NPC: 15 Hz and secondary motion disabled.
- Distant NPC: 8 Hz, expressions and secondary motion disabled.

Root motion/position remains owned by each game every frame. The scheduler only reduces expensive visual pose/expression/spring work.

## Texture/material budget

Runtime texture quality adjusts anisotropy without mutating source assets. Character Workshop continues to report material/token usage and runtime texture-memory estimates.

Shared GLTF loading now enables Meshopt by default and renderer-aware KTX2/Basis loading. App predev/prebuild hooks copy the Three.js Basis transcoder locally, so compressed assets do not depend on a public CDN.

Repository CI also runs a changed-asset visual budget guard. New or modified oversized raster/model assets fail the hard guard; softer thresholds produce review warnings encouraging KTX2/Basis compression, texture atlases, fewer materials, authored LOD and HLOD planning.

Existing legacy asset debt is reported by `npm run visual:budget` but is not retroactively made a merge blocker.

## World streaming, occlusion and HLOD boundary

The shared world exposes cell preload/retain planning with hysteresis. MURAAAAAAA uses this as a common-world streaming contract while reducing visual-only vegetation density. 尽喰廻遊 also uses distance streaming on non-critical static environment roots.

A bounded conservative occlusion layer may additionally hide static set dressing only when all sampled rays are blocked. Large structures, interaction-critical roots and explicitly critical landmarks are excluded. Existing optimized environment chunks act as HLOD-sized units; future authored cell proxies can replace those chunks without changing the streaming contract.

## Static batching and atlas

Repeated static leaf meshes with exact shared geometry/material identity can be converted to `InstancedMesh` batches while their source graph remains recoverable. Critical, interactive, skinned and morphed objects are excluded.

The shared atlas helper validates atlas manifests, can build small runtime Canvas atlases, and can clone/remap geometry UVs into a slot. Production texture baking should still happen offline when possible.

## Stylized shading

MeshStandardMaterial surfaces can receive a restrained profile-dependent rim contribution. Hero/enemy readability gets slightly more rim separation; environment/props remain subtle. The effect is additive to the existing Cool Ambient × Warm Local PBR direction and is not a flat/unlit replacement.

## Transparency / overdraw pressure

Mobile scenes can become GPU-heavy even after polygon reduction because hair cards, vegetation, smoke, spell VFX and other alpha-blended surfaces still consume fill and blending bandwidth.

`@soul/rendering/transparency-audit` therefore provides a low-frequency QA estimate for:

- blended material count;
- cutout material count;
- blended draw calls;
- cutout draw calls;
- transparent triangle upper bound;
- cutout triangle upper bound.

This is deliberately described as a **pressure estimate**, not physical GPU overdraw or screen coverage. A mesh using mixed materials contributes its full triangle count as a conservative upper bound. MURAAAAAAA and 尽喰廻遊 refresh the audit only periodically, then attach the latest values to Performance Lab samples and diagnostics.

Transparency regressions are review warnings. Actual frame/GPU regressions remain the hard runtime evidence.

## Performance Regression Lab

Village and demon continuously retain bounded rolling telemetry for frame p50/p95/p99, GPU p95 when available, long frames, draw calls, triangles, estimated texture bytes and transparency pressure.

- `npm run performance:browser -- village`
- `npm run performance:browser -- demon`
- `npm run performance:browser -- village --preset pixel-fold-class`
- `npm run performance:browser -- demon --preset pixel-fold-class`
- `npm run performance:compare -- --baseline before.json --current after.json`

The `pixel-fold-class` preset is a deterministic synthetic browser reference with a 30 fps / 33.34 ms target and a fixed mobile viewport/sample count. Its report explicitly identifies itself as synthetic. It must not be cited as physical Pixel Fold evidence. Real-device evidence remains a separate measurement under the Character Production / runtime readiness rules.

Comparisons are ratio-based and must use the same benchmark scenario/device class. Captures from unrelated hardware are not treated as valid regressions.

## Asset compiler

`npm run asset:optimize -- --input <source> --role <role>` is the normal one-command authoring entry point for low/mid-poly runtime assets.

It:

- resolves canonical role budgets from `STYLIZED_ART_PROFILES` rather than duplicating numbers;
- generates authored `_LOD0/_LOD1/_LOD2` output through the existing Blender route when LOD generation is enabled;
- compresses the generated runtime GLB through the existing Meshopt/KTX2 wrapper when compression is enabled;
- preserves the fail-closed character rules for Shape Keys, skin groups and production-stage evidence;
- audits source triangles, material count, estimated draw calls, UV/skin preservation and silhouette/extent drift;
- emits one JSON report containing source/output paths, executed/skipped stages, DCC audit evidence, file sizes, compression ratio, LOD evidence and budget verdicts;
- supports `--plan` so CI/workers can review the intended commands without requiring Blender or `gltfpack`;
- never claims a DCC or compression stage succeeded when the required executable/artifact is missing.

Budgets are role-specific authoring review gates for `hero`, `npc`, `enemy`, `environment`, `prop` and `distant`. A soft budget overage returns `review`; DCC safety failures return `fail`.

For example:

```sh
npm run asset:optimize -- --input art/characters/shino.blend --role hero --plan
npm run asset:optimize -- --input art/characters/shino.blend --role hero
npm run asset:optimize -- --input assets/world/tree.glb --role environment
```

The compiler complements, rather than replaces, runtime Performance Lab evidence and the Character Production Pipeline. Human visual approval remains required where that pipeline requires it. A generated file is not automatically `RUNTIME_READY`.

## Verification

The fast PR gate covers adaptive-quality transitions, GPU/CPU pressure classification, animation throttling, authored LOD selection, compression wiring, texture budgeting, shading hook stability, streaming hysteresis, conservative occlusion, static batching/atlas UV remap and per-app bridge ordering. Asset compiler and transparency telemetry have focused Node coverage. Character Workshop remains the human-facing Art / Performance QA surface.
