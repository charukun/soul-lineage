# Public Web Asset Library

Task: widen shared asset sourcing beyond GitHub for Rinne, MURAAAAAAA and 尽喰廻遊 without weakening license or production gates.

Audit date: 2026-09-16.

## Rules

- Prefer CC0 or MIT. Preserve source, license and an immutable revision/hash whenever one exists.
- Runtime code must not depend on mutable third-party URLs. `AUDITED_REMOTE_CANDIDATE` means approved for later materialization, not shipped/runtime-ready.
- `MATERIALIZED` means the source file exists in this repository. It still does not imply art approval, `RUNTIME_READY`, collision suitability or Production approval.
- Do not import raw assets whose current terms prohibit redistribution. Quaternius was reviewed but is intentionally excluded from vendoring for that reason.

## Materialized in this change

`stegu/webgl-noise@22434e04d7753f7e949e8d724ab3da2864c17a0f` (MIT):

- `noise2D.glsl` for dissolve, smoke masks and screen/world distortion.
- `noise3D.glsl` for volumetric-feeling fire, fog and magic modulation.
- local root: `assets/vendor/public-web/stegu-webgl-noise/`
- upstream blob ids are recorded in `MANIFEST.json`.

These are shared VFX building blocks for all three apps; individual apps still choose their own art direction and effect timing.

## Audited remote candidates

The shared catalog also records candidates that are license-cleared but deliberately not bundled yet:

- Kenney Impact Sounds, Interface Sounds and UI Audio (CC0): combat hits, menus and confirmation feedback.
- Kenney Nature Kit (CC0): additional vegetation/rocks where the existing KayKit set is too sparse.
- Kenney Particle Pack (CC0): sparks, slash/smoke/magic-style particle textures.
- Poly Haven `medieval_blocks_05`, `grassy_cobblestone`, `cobblestone_01` and `zavelstein` HDRI (CC0): medieval surfaces, roads/ground and neutral outdoor lighting reference.
- ambientCG `WoodSiding006` (CC0): wood surface variation for structures and props.

Where Kenney publishes stable archive URLs and checksums, they are recorded in `packages/assets/src/public-web-catalog.js` so later materialization can verify the download before extraction.

## Existing GitHub materialized set

The earlier KayKit Medieval Hexagon 13-model set remains in `assets/vendor/public-github/kaykit-medieval-hexagon/` and continues to be exported through `publicGithubAssetCatalog`. The new public-web catalog extends that system rather than replacing it.

## Adoption

`@soul/assets` now exports `PUBLIC_WEB_ASSET_SOURCES`, `publicWebAssetCatalog` and `publicWebAssetsForApp(appId, options)`. All entries cover `rinne`, `village` and `demon`; apps can filter `MATERIALIZED` assets today and separately review remote candidates before download/use.
