# Stylized Performance Pipeline

This document extends `STYLIZED_LOW_MID_POLY.md` with the runtime performance and authoring contract implemented after the initial visual-target phase.

## Principle

Performance is recovered from invisible or low-value detail and reinvested into silhouette, motion, lighting and VFX. Gameplay state, collision, network authority and save data never depend on visual quality tiers.

## Authored LOD

Static environment and prop assets may provide sibling meshes named `<name>_LOD0`, `<name>_LOD1` and `<name>_LOD2`.

- LOD0 is the authored near mesh.
- LOD1 is the readable mid-distance mesh.
- LOD2 is the far mesh.
- If an authored lower LOD is missing, the safe bounding-box proxy remains the final fallback for eligible static meshes.
- Skinned/morphed character meshes are never runtime-decimated.

The runtime contract is complete. Individual art assets can adopt authored LOD siblings incrementally without changing game code.

## Adaptive quality

`@soul/rendering/adaptive-quality` exposes four presentation tiers: full, balanced, mobile and survival. A hysteretic FPS governor changes tiers only after sustained pressure/recovery to avoid visual pumping.

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

Repository CI also runs a changed-asset visual budget guard. New or modified oversized raster/model assets fail the hard guard; softer thresholds produce review warnings encouraging KTX2/Basis compression, texture atlases, fewer materials, authored LOD and HLOD planning.

Existing legacy asset debt is reported by `npm run visual:budget` but is not retroactively made a merge blocker.

## World streaming and HLOD boundary

The shared world exposes cell preload/retain planning with hysteresis. MURAAAAAAA uses this as a common-world streaming contract while currently reducing visual-only vegetation density. 尽喰廻遊 also uses distance streaming on non-critical static environment roots.

Large structures, interaction-critical roots and explicitly critical landmarks are excluded from visual culling. Existing optimized environment chunks act as HLOD-sized units; future authored cell proxies can replace those chunks without changing the streaming contract.

## Stylized shading

MeshStandardMaterial surfaces can receive a restrained profile-dependent rim contribution. Hero/enemy readability gets slightly more rim separation; environment/props remain subtle. The effect is additive to the existing Cool Ambient × Warm Local PBR direction and is not a flat/unlit replacement.

## Verification

The fast PR gate covers adaptive-quality transitions, animation throttling, authored LOD selection, texture budgeting, shading hook stability, streaming hysteresis and per-app bridge ordering. Character Workshop remains the human-facing Art / Performance QA surface.
