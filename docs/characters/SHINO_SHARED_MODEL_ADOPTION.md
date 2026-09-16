# Shino shared model adoption

## Scope

Adopt the repository's audited `shino.reference.v2` DCC asset as the shared Shino-derived humanoid candidate used by all three DEV applications: `apps/rinne`, `apps/village`, and `apps/demon`.

This task is an explicit user-directed exception to the normal KayKit-first game-facing default. It does not remove KayKit assets or change main / Production. Existing gameplay, collision, inventory, save/network authority, and motion timing remain owned by each app.

## Source and provenance

The base lineage remains the public `Sendagaya_Shino` model pinned in `docs/characters/MASTER_CHARACTER.md`:

- upstream repository: `yw0nam/YUI`
- upstream commit: `9bce6c36d28f58693db3ce6f4203871ab1c11b76`
- upstream path: `resources/vrms/Sendagaya_Shino.vrm`
- original: VRoid Project / pixiv Inc., CC0
- reviewed VRM 1.0 conversion: Coatie (`coati`), with embedded VRM Public License 1.0 metadata

The adopted runtime candidate is the already-authored DCC derivative:

- runtime: `apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm`
- editable source: `assets/characters/shino/reference-v2/source/ShinoReferenceV2.blend`
- production manifest: `packages/characters/production/shino-reference.production.json`
- identity reference: `docs/characters/references/shino/shino-character-reference-sheet-v2.png`
- exact SHA-256: `5f730603f1cd32f743ecbcdd279cf1d3233839fcf36277876a185abbf8eb3e2e`
- exact size: `1453736` bytes
- current production stage: `PRIMARY / dcc-blender`
- visual approval: `pending`
- production ready: `false`

No newly discovered third-party surface is imported without an equally traceable license and hash. Network candidates that cannot be fetched and audited as real files are comparison references only, not runtime dependencies.

## Acceptance

- The three apps resolve the same exact Shino Reference v2 runtime bytes through a shared descriptor/loader contract rather than app-specific hard-coded model identities.
- Rinne's current gameplay actor states, equipment ownership, combat timing, carrying flow, peer state, and motion state remain unchanged; only the rendered humanoid template changes.
- Village preserves its resident identity/age/modular appearance behavior while replacing the old `SHINO_review.vrm` runtime source with the DCC candidate.
- Demon preserves the master-human loader contract while replacing `PROTAGONIST_VILLAGER_V1.glb` with the same DCC candidate.
- Runtime loaders verify the exact asset hash and size before parsing.
- Existing fallback behavior remains fail-safe. A failed model load must not corrupt authoritative simulation state.
- Character Production stays `PRIMARY`; this adoption must not claim POLISH or RUNTIME_READY before the remaining visual/deformation/motion/device gates pass.
- Affected character/rendering/app tests and fast validation must pass before Ready for review.

## External-search decision

The implementation first checks openly distributed candidates. An external candidate is not preferred merely because its screenshot looks closer. The repository already contains an audited public-source Shino rig plus a DCC-authored derivative targeted directly to the current `shino-character-reference-sheet-v2.png`; that source chain is therefore the lowest-risk and closest controllable base for the three-app adoption.
