# Public Web Asset Library Phase 4

Phase 4 expands the shared, audited public-web asset library for `rinne`, `village`, and `demon` from Phase 3's audio / basic nature / PBR baseline into denser environment dressing and lightweight presentation assets.

## Planned materialized subset

Prioritize small, reusable, redistribution-safe assets with clear provenance. Do not import full packs when a compact semantic subset is enough.

- Kenney Foliage Sprites / CC0
  - grass / foliage / leaf / dust-adjacent sprites suitable for billboard vegetation and lightweight VFX
- Kenney Survival Kit and/or Mini Forest / CC0
  - a small GLB subset for logs, camp / wilderness props, shrubs / forest dressing when source files and license provenance can be pinned
- Poly Haven Wood Planks / CC0
  - mobile/WebGL-oriented 1K diffuse / OpenGL normal / roughness maps

## Candidate-only scope

Keep larger or context-sensitive assets remote until an app-specific adoption task can justify the runtime and repository cost.

- Niederwihl Forest HDRI / CC0
- Kenney Mini Characters / CC0
- Kenney Mini Dungeon / CC0
- Kenney Modular Cave Kit / CC0
- Kenney Retro Fantasy Kit / CC0

## Acceptance

- source license must explicitly allow redistribution
- canonical source and immutable provenance must be recorded
- materialized binaries must have SHA-256 entries in a Phase 4 manifest
- Git-backed transport files also record fixed commit and exact Git blob IDs where practical
- runtime must not depend on third-party URLs
- shared metadata stays under `packages/assets`
- app code is not changed in this phase
- temporary materialization workflows remove themselves after successful commit
- `main` and Production remain unchanged
