# Public GitHub Asset Expansion

Task: expand reusable public-GitHub 3D assets for Rinne, MURAAAAAAA, and 尽喰廻遊.

Base develop: `be168a9fa631406d1c03bfc904ccd2886a1d1b10`

## Selection policy

- Prefer immutable GitHub revisions and permissive CC0/MIT licensing.
- Materialize runtime candidates into this repository. Runtime code must not depend on mutable upstream URLs.
- Preserve upstream license text, exact commit, upstream path, Git blob id, size, and local path in the manifest.
- New third-party assets remain visual candidates. Import does not imply `RUNTIME_READY`, Production approval, gameplay authority, collision suitability, or human Visual Approval.
- Do not duplicate an existing repository-local asset when an equivalent candidate is already present.

## Phase 1 source

`KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`

- exact commit: `84fa4e91af6a88989be7c99e0891cede11f2ca38`
- license: CC0 1.0
- upstream README describes 200 low-poly optimized models and glTF support.
- selected shared props: arrow bucket, ladder, lumber pile, stone pile, sack, training target, tent, weapon rack, wheelbarrow.
- shared texture: `hexagons_medieval.png`.

## Intended use

- Rinne: camps, training spaces, roadside/settlement dressing, weapon practice staging.
- MURAAAAAAA: work yards, storage, construction/resource loops, guard/training areas, settlement dressing.
- 尽喰廻遊: abandoned camps, scavenging/ruin dressing, human defensive positions, encounter staging.

These are deliberately generic props so each app can art-direct placement independently while sharing one audited source set.
