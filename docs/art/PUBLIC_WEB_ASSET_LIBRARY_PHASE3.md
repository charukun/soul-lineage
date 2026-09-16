# Public Web Asset Library Phase 3

Phase 3 extends the shared, audited public-web asset surface for `rinne`, `village`, and `demon` without introducing runtime third-party URL dependencies.

## Materialized subset

### Kenney RPG Audio / CC0

Canonical source: <https://kenney.nl/assets/rpg-audio>

Ten semantic cues are stored locally instead of shipping the entire 50-file pack:

- blade draw
- two blade slash variations
- cloth foley
- door open / close
- two generic footsteps
- coin handling
- book page flip

Transport uses `Boyquotes/kenney-rpg-audio-for-godot` commit `22eb79bb843bbcadcaa6ed119353a33265ffad11`. Every selected OGG is checked against its exact Git blob ID before commit. The canonical license authority remains Kenney, not the transport mirror.

### Kenney Nature Kit / CC0

Canonical source: <https://kenney.nl/assets/nature-kit>

The official archive is pinned by SHA-256 `fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d`. Only three cross-app GLBs are selected from the 330-file pack:

- oak tree
- simple fence
- wooden sign

These are suitable for repeated instancing and generic village / wilderness dressing without coupling any app to another app.

### Poly Haven Grassy Cobblestone / CC0

Canonical source: <https://polyhaven.com/a/grassy_cobblestone>

The local mobile/WebGL review subset contains only 1K JPG maps:

- diffuse
- OpenGL normal
- roughness

The committed-byte hashes and exact fetch URLs are stored in `assets/vendor/public-web/PHASE3_MANIFEST.json`.

## Shared catalog

`packages/assets/src/public-web-catalog.js` exposes the selected Phase 3 files as `MATERIALIZED` semantic assets for all three apps. Full packs remain `AUDITED_REMOTE_CANDIDATE` where materializing the whole archive would add unnecessary repository and runtime weight.

Phase 3 also records safe remote candidates for later targeted adoption:

- Kenney Skyboxes / CC0
- Kenney Light Masks / CC0
- Poly Haven Steinbach Field HDRI / CC0
- existing Poly Haven Cobblestone, Zavelstein HDRI and ambientCG wood candidates

## Audited next-wave candidates

Current public sources that are strong Phase 4 candidates but are intentionally not shipped in this PR:

- Kenney Mini Forest: animated 3D forest set, CC0
- Kenney Survival Kit: 3D survival / nature props, CC0
- Kenney Foliage Sprites: grass and foliage VFX sprites, CC0
- Kenney Mini Characters: animated low-poly characters, CC0
- Kenney Mini Dungeon: animated / variant medieval dungeon set, CC0
- Poly Haven Wood Planks: weathered wood PBR, CC0
- Poly Haven Niederwihl Forest: soft overcast forest HDRI, CC0

These stay remote until a later phase selects a small semantic subset instead of importing full packs by default.

## Integrity and acceptance

- only assets with explicit redistribution-compatible licensing are materialized
- no app imports another app; shared asset metadata remains under `packages/assets`
- `PHASE3_MANIFEST.json` records all 16 imported binary files and SHA-256 hashes
- Git-backed RPG audio additionally records fixed commit and exact Git blob IDs
- the Nature Kit archive is verified before extraction
- temporary one-shot materializer removes itself after successful commit
- no game runtime depends on Kenney, GitHub, Poly Haven or another third-party URL
- Phase 3 changes remain limited to shared asset storage, catalog, tests and documentation
- `main` and Production are not modified
