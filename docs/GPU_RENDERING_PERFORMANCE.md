# GPU-aware Rendering Performance Pipeline

## Purpose

This layer extends the Stylized Low / Mid Poly runtime with performance decisions that preserve visual quality instead of blindly lowering every setting when frame rate falls.

The system is presentation-only. Gameplay state, collision, save data, damage authority and multiplayer/network authority remain independent.

## GPU-aware quality

`@soul/rendering/gpu-timer` uses `EXT_disjoint_timer_query_webgl2` when the browser/driver exposes it. Queries are asynchronous and bounded. Unsupported or disjoint devices fail open and continue using frame-time-only quality control.

`@soul/rendering/gpu-aware-quality` classifies sustained pressure as GPU, CPU, mixed, healthy or unknown. The existing adaptive-quality hysteresis still owns quality levels. The pressure axis only decides where to spend the budget:

- GPU pressure: render scale, shadows and VFX can be reduced first.
- CPU pressure: image resolution is preserved where possible while vegetation, streaming radius and animation update cost are reduced first.
- mixed pressure: both sides reduce moderately.

This prevents CPU-heavy scenes from being made unnecessarily blurry.

## Meshopt and KTX2/Basis

The shared GLTF path supports `EXT_meshopt_compression` through Three.js `MeshoptDecoder`.

Renderer-aware loading additionally enables `KTX2Loader`. The Three.js Basis transcoder files are copied from the installed `three` package into each app's generated `public/basis/` directory by `scripts/prepare-basis-assets.mjs`. Those generated binaries are not source-controlled.

App `predev` and `prebuild` hooks create the transcoder directory before Vite starts or builds. Uncompressed GLB/VRM/glTF remains fully supported.

For DCC/CI environments with `gltfpack` installed:

```sh
npm run gltf:compress -- --input model.lod.glb --output model.optimized.glb
```

`GLTFPACK_BIN` can point at a specific executable. The wrapper requests Meshopt geometry compression and KTX2 texture compression and fails explicitly when the encoder is unavailable or produces no output.

## Conservative occlusion

`@soul/rendering/occlusion` performs bounded ray-based occlusion checks against eligible static set dressing. A candidate is hidden only after every sampled ray is blocked and the result is confirmed across multiple checks.

Important safety properties:

- near objects are never occlusion-tested;
- critical/interactable roots are excluded;
- another system's hidden state is never force-restored;
- checks are capped per update;
- failures reveal rather than hide.

Distance streaming and frustum culling remain the first line of defence. Occlusion is an additional presentation layer.

## Static instancing and atlas

`@soul/rendering/instance-atlas` batches repeated static leaf meshes only when geometry and material identity are exactly shared. Interactive, critical, skinned, morphed and explicitly excluded objects are not batched.

Original source meshes remain in the object graph but presentation-hidden, so diagnostics can restore the batch without reconstructing gameplay ownership.

The same module validates atlas manifests, can build bounded Canvas texture atlases, and can clone/remap geometry UVs into an atlas slot. Offline DCC baking remains preferred for large production assets, but procedural/small shared assets can use the runtime path without inventing a separate atlas convention.

## DCC LOD generation

Run:

```sh
npm run lod:generate -- --input path/to/source.blend --output path/to/model.lod.glb --audit path/to/model.lod.audit.json --mode static
```

or use `--mode character` for a skinned mesh without Shape Keys.

`scripts/blender/generate-lods.py` creates `_LOD1` and `_LOD2` siblings from `_LOD0`/source meshes and audits:

- triangle reduction;
- material-slot preservation;
- UV-layer preservation;
- skin vertex-group preservation in character mode;
- front, side and three-quarter convex-hull silhouette area;
- width, depth and height drift.

Shape Key meshes fail closed because generic Decimate would damage facial/morph semantics. Those meshes require authored LOD topology.

The resulting GLB follows the runtime `_LOD0/_LOD1/_LOD2` convention already consumed by the Stylized pipeline.

## Performance Regression Lab

`@soul/rendering/performance-lab` records bounded rolling samples for:

- frame average / p50 / p95 / p99;
- GPU average / p95 when GPU timing is available;
- long frames over 50 ms;
- draw calls;
- rendered triangles;
- estimated texture bytes.

Village exposes this through `window.__VILLAGE_ADAPTIVE_QUALITY__.snapshot()` and demon through `window.__DEMON_ADAPTIVE_QUALITY__.snapshot()`.

A deterministic mobile-class capture can be produced with:

```sh
npm run performance:browser -- village
npm run performance:browser -- demon
```

The existing PR browser evidence hook also stores `<app>-performance.json` inside `test-results/pr-browser/`, so normal browser artifacts carry the same telemetry without a second browser run.

Two captured JSON snapshots can be compared with:

```sh
npm run performance:compare -- --baseline before.json --current after.json
```

Default hard regression thresholds are ratio-based. Frame p95, GPU p95 and draw calls fail the comparison; triangle/texture growth is reported for review unless accompanied by a hard runtime regression.

Do not compare timings from unrelated hardware as if they were the same benchmark.

## Target usage

The preferred benchmark scene is deterministic: same app build mode, same viewport/device, same world seed, same camera path, same actor count and enough warmup to avoid counting first-load shader/asset setup as steady-state rendering.

Pixel Fold-class mobile remains a 30 fps class target. Desktop remains a 60 fps class target. The quality governor uses these as presentation targets, not gameplay simulation rates.
