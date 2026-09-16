# Public GitHub Asset Expansion

Task: expand reusable public-GitHub visual assets for Rinne, MURAAAAAAA, and 尽喰廻遊.

Starting develop: `be168a9fa631406d1c03bfc904ccd2886a1d1b10`

## Selection policy

- Prefer immutable GitHub revisions and permissive CC0/MIT licensing.
- Materialize shared source candidates into this repository. Runtime code must not depend on mutable upstream URLs.
- Preserve upstream license text and exact source revision. Materialization verifies each downloaded file with `git hash-object` against the immutable upstream Git blob id before it can be committed.
- New third-party assets remain visual candidates. Import does not imply `RUNTIME_READY`, Production approval, gameplay authority, collision suitability, or human Visual Approval.
- Do not duplicate an existing repository-local asset when an equivalent candidate is already present.

## Materialized source set

`KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`

- exact commit: `84fa4e91af6a88989be7c99e0891cede11f2ca38`
- license: CC0 1.0
- upstream README describes 200 low-poly optimized models and glTF support.
- local root: `assets/vendor/public-github/kaykit-medieval-hexagon/`
- shared atlas: `hexagons_medieval.png`
- manifest: `assets/vendor/public-github/kaykit-medieval-hexagon/MANIFEST.json`

Selected 13 reusable models:

- props (9): arrow bucket, ladder, lumber pile, stone pile, sack, training target, tent, weapon rack, wheelbarrow
- nature (4): tree A, tree B, rock A, rock C

The temporary download/materialization workflow deleted itself after committing the verified asset set. The final feature diff therefore retains the assets, provenance/license data, shared catalog and tests, not a standing download workflow.

## Shared catalog

`@soul/assets` exports:

- `PUBLIC_GITHUB_ASSET_SOURCE`
- `publicGithubAssetCatalog`
- `publicGithubAssetsForApp(app)`

Every imported item is explicitly tagged `VISUAL_CANDIDATE` and available to `rinne`, `village`, and `demon` through the same catalog. The catalog points to repository source paths; app-specific publication/scene placement remains an explicit later art-direction step rather than silently copying all 13 models into every shipped bundle.

## Intended use

- Rinne: camps, training spaces, roadside/settlement dressing, weapon-practice staging, sparse forest/rock dressing.
- MURAAAAAAA: work yards, storage, construction/resource loops, guard/training areas, settlement and nature dressing.
- 尽喰廻遊: abandoned camps, scavenging/ruin dressing, human defensive positions, encounter staging and terrain breakup.

These are deliberately generic props/nature pieces so each app can art-direct placement independently while sharing one audited source set.

## Existing reusable public-GitHub VFX found during audit

尽喰廻遊 already contains a pinned CC0 Kenney Particle Pack set from `Calinou/kenney-particle-pack@ab7086639ee73be31abd87feb21bf1402d4e8144` with spark, slash, smoke, flare, magic, circle, star and flame textures. That set was not duplicated in this task. It is an existing repository-local source that can be promoted into a future shared VFX catalog for Rinne and MURAAAAAAA after each app's presentation needs are defined.

## Verification boundary

The materializer verified every downloaded upstream file against its pinned Git blob id. `packages/assets/tests/public-github-catalog.test.mjs` additionally checks catalog/manifest parity, all-three-app coverage, glTF 2.0 metadata and local `.bin`/atlas dependencies. This execution environment has no repository checkout, so the Node test itself is handed to the exact-head repository CI rather than claimed as locally executed.
