# Visual Asset Inventory and VRM Preflight

## Purpose

The low/mid-poly pipeline needs a repository-wide view of actual asset debt, not only per-change budget checks. This contract defines a read-only inventory and prioritisation layer on top of the existing Asset Compiler.

The inventory does not promote assets through the Character Production Pipeline and does not convert review VRMs into production sources.

## Required outputs

`npm run asset:inventory` must inspect tracked `.glb`, `.gltf` and `.vrm` runtime/review assets and produce machine-readable rows with, when the container exposes them:

- path, extension and file bytes;
- glTF/VRM version and declared extensions;
- mesh, primitive, material, texture/image and animation counts;
- triangle count when index/position accessor counts make it measurable;
- skin and joint counts;
- morph-target presence/count;
- Meshopt / KTX2-family compression evidence;
- authored `_LOD0/_LOD1/_LOD2` naming evidence;
- review/source-risk classification;
- a bounded optimisation priority score and recommended next action.

The report must include a sorted top-priority queue so the repository can answer which assets should be optimised next without loading every model manually.

## VRM preflight

`npm run asset:inspect -- --input <file.vrm>` is read-only. VRM is treated as a GLB container for metadata inspection only.

A review VRM may expose useful performance evidence, but it is not an editable/canonical DCC source merely because it can be parsed. The inspector must preserve this distinction and must not claim that destructive optimisation is safe for a skinned, morphed or review-only asset.

When a role is explicitly provided, the inspector may compare measurable counts with the existing `STYLIZED_ART_PROFILES` soft budgets. Missing measurements remain `unknown`; they are never silently converted to pass.

## Priority policy

Priority is evidence-driven and deterministic. Larger uncompressed assets, high measurable geometry/material/texture counts and missing authored LOD evidence increase review priority. Skinned/morphed assets are routed toward authored-DCC work rather than automatic decimation.

The queue is advisory. Identity, provenance, licensing, visual approval and runtime readiness remain governed by the existing character/art contracts.

## Boundaries

- no source asset mutation;
- no VRM-to-production-source promotion;
- no automatic character decimation;
- no gameplay, collision, save or network changes;
- no main / Production changes;
- no weakening of visual approval, provenance or device-performance gates.

## Acceptance

This phase is complete when a single-asset preflight and repository-wide inventory share the same parser, focused tests cover GLB/VRM metadata and prioritisation, the root scripts expose both commands, and reports distinguish measured, inferred and unavailable evidence.
