# Character Reference → Model Builder

## Purpose

Character reference sheets are production inputs, not executable 3D assets. This pipeline turns a repository reference into a provider-neutral build request, accepts a concrete VRM/GLB candidate from an external modeling provider, runs the candidate through explicit Character Workshop/CI gates, and only then emits a distribution manifest for the games.

```text
Character Reference
  ↓
Model Build Request
  ↓
Provider Adapter (Astra-class worker / Blender / future generation API / manual modeling)
  ↓
VRM or GLB Candidate
  ↓
MasterCharacter compatibility + Character Workshop QA
  ↓
Accepted Candidate
  ↓
Distribution Manifest
  ↓
rinne / village / demon adapters through shared character packages
```

The repository does **not** claim that an image alone is already converted into production geometry. The geometry-producing provider is an adapter. The shared contract and acceptance path are implemented now so the provider can be swapped without changing game code.

## Source authority

Every reference catalog entry keeps four authority buckets:

- `CURRENT MASTER`: identity/base mesh/rig/material behavior that is already authoritative.
- `IMPLEMENTED MODULAR PARTS`: parts that already exist in the shared character/rendering implementation.
- `PROPOSED PARTS`: production requirements only. They are never reported as implemented until an asset/provider supplies and passes them.
- `GAME EQUIPMENT`: remains game-owned and is excluded from the shared character asset unless a later reviewed contract explicitly adopts it.

This prevents a visual sheet from silently upgrading concept details into runtime truth.

## Shared API

`packages/characters/src/model-builder.js` exposes:

- `createCharacterModelBuildRequest(referenceId, options)`
- `createCharacterModelProvider(id, build)`
- `buildCharacterModel(request, provider)`
- `createCharacterModelCandidate(request, artifact)`
- `reviewCharacterModelCandidate(candidate, results)`
- `createCharacterDistributionManifest(candidate, targets)`

A provider implements only `build(request)` and returns `{ format, path|uri, sha256, provider? }`. Runtime/game packages do not import the provider.

## Required acceptance gates

A candidate stays on the current audited MasterCharacter fallback until every required gate passes:

1. `provenance`
2. `identity`
3. `silhouette`
4. `topology`
5. `rig`
6. `materials`
7. `clipping`
8. `motion`
9. `performance`

Any `fail` rejects the candidate. Missing/pending gates keep it in `needs-review`. A distribution manifest cannot be created from a pending/rejected candidate.

The gates are intentionally broader than numeric mesh checks. Identity/silhouette/clipping/motion still require visual evidence; existing Motion QA can be used for the motion/clipping portion.

## Character Workshop

When a reference model is selected in `apps/rinne/characters.html`, Character Workshop exposes `モデル生成仕様JSON`. The exported request contains the reference path, MasterCharacter fallback, authority buckets, target format/rig/material requirements, QA gates and target apps.

This request is the handoff to a modeling worker. Editing a generated/quantity model does not create a build request because there is no reference authority to preserve.

## CLI / worker flow

Create a request:

```sh
node scripts/character-model-builder.mjs request shino.reference.v2 generated/shino/request.json astra-3d
```

After an external provider produces a concrete asset, wrap it as a candidate using its real SHA-256:

```sh
node scripts/character-model-builder.mjs candidate \
  generated/shino/request.json \
  vrm \
  generated/shino/shino.vrm \
  <64-char-sha256> \
  astra-3d \
  generated/shino/candidate.json
```

Apply a gate-results JSON:

```sh
node scripts/character-model-builder.mjs review \
  generated/shino/candidate.json \
  generated/shino/gates.json \
  generated/shino/reviewed.json
```

Only when `acceptance.status` is `accepted` may a distribution manifest be emitted:

```sh
node scripts/character-model-builder.mjs distribute \
  generated/shino/reviewed.json \
  generated/shino/distribution.json
```

The manifest is an Integration handoff, not permission to mutate `main` or Production and not a game-save operation.

## Current provider boundary

No authenticated 3D-generation endpoint is bundled in this repository. Therefore the repository now owns the complete production contract, adapter interface, candidate validation, Workshop handoff, acceptance gate and distribution manifest, while actual mesh synthesis remains the responsibility of the selected external provider. When a model-generation API or dedicated modeling worker is connected later, it should implement the existing provider adapter rather than introducing a second character pipeline.
