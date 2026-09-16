# Public Web Asset Library Phase 4

Phase 4 expands the shared, audited asset library for `rinne`, `village`, and `demon` with lightweight forest dressing, billboard foliage, presentation VFX, light masks, and a mobile-oriented wood PBR material. App code is intentionally unchanged; adoption remains an app-specific visual task.

## Materialized subset

### Kenney Mini Forest

- license: CC0-1.0
- canonical source: `https://kenney.nl/assets/mini-forest`
- immutable public GitHub mirror: `shorepine/kenney@3694c6879e487c108f55677be7dd2ca75b07cc3b`
- local root: `assets/vendor/public-web/kenney-mini-forest/`
- curated GLB models: bridge, fence, ladder, grass patch, plant, tall rocks, stones, tent, tree
- each imported GitHub file is checked against its exact Git blob ID before commit

### Kenney Foliage Sprites

- license: CC0-1.0
- canonical source: `https://kenney.nl/assets/foliage-sprites`
- immutable public GitHub mirror: `shorepine/kenney@3694c6879e487c108f55677be7dd2ca75b07cc3b`
- local root: `assets/vendor/public-web/kenney-foliage-sprites/`
- 4 flat and 4 shaded PNG variants for billboard vegetation / lightweight atmospheric dressing

### Kenney Smoke Particles

- license: CC0-1.0
- immutable public GitHub mirror: `shorepine/kenney@3694c6879e487c108f55677be7dd2ca75b07cc3b`
- local root: `assets/vendor/public-web/kenney-smoke-particles/`
- 2 white-puff PNGs for mist, dust, footsteps, impacts, and forest atmosphere

### Kenney Light Masks

- license: CC0-1.0
- canonical source: `https://kenney.nl/assets/light-masks`
- immutable public GitHub mirror: `shorepine/kenney@3694c6879e487c108f55677be7dd2ca75b07cc3b`
- local root: `assets/vendor/public-web/kenney-light-masks-phase4/`
- noise and streaked-noise masks for dappled forest light, projected light, skill presentation, and fog breakup

### Poly Haven Wood Planks

- license: CC0-1.0
- canonical asset: `https://polyhaven.com/a/wood_planks`
- public API implementation/provenance: `Poly-Haven/Public-API`
- local root: `assets/vendor/public-web/polyhaven-wood-planks/`
- curated 1K JPG set: diffuse, OpenGL normal, roughness
- runtime does not depend on the live API or CDN after materialization

The Poly Haven files come from the canonical Poly Haven download service rather than an arbitrary GitHub re-upload. This preserves the stronger asset provenance while the API implementation itself is public on GitHub.

## Shared metadata

`packages/assets/src/public-web-phase4-catalog.js` exposes five audited sources and 22 `MATERIALIZED` shared entries. All entries are available to the three app IDs through `publicWebPhase4AssetsForApp()`.

The catalog is exported from `@soul/assets` but does not alter any app renderer, scene composition, collision, gameplay, or Production configuration.

## Verification

- every materialized binary is recorded in its source `MANIFEST.json` with SHA-256
- Git-backed files additionally record the pinned commit and exact Git blob ID
- GLB imports are checked for glTF 2.0 headers
- PNG and JPEG signatures are checked during materialization
- `packages/assets/tests/public-web-phase4-catalog.test.mjs` re-hashes all manifest files and verifies catalog paths / app exposure
- temporary materialization workflow deletes itself after a successful commit

## Deferred candidates

These remain candidate-only until an app-specific need justifies additional repository/runtime cost or compatibility work:

- Kenney Survival Kit: not imported in this phase; Mini Forest covers the immediate camp / wilderness need without taking on a second overlapping 3D pack
- Niederwihl Forest HDRI
- Kenney Mini Characters
- Kenney Mini Dungeon
- Kenney Modular Cave Kit
- Kenney Retro Fantasy Kit

## Boundaries

- no app code changed
- no automatic scene placement
- no gameplay/collision semantics implied by the catalog
- no `main` or Production changes
