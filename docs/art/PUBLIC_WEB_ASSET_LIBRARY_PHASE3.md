# Public Web Asset Library Phase 3

Phase 3 extends the shared, audited public-web asset surface for `rinne`, `village`, and `demon` without introducing runtime third-party URL dependencies.

## Scope

- materialize a minimal semantic subset of Kenney RPG Audio for weapon, foley and additional movement cues
- materialize additional low-resolution CC0 PBR material maps suitable for mobile/WebGL review
- audit lightweight CC0 sky/lighting and vegetation sources; materialize only assets that are clearly reusable across all three apps
- preserve source provenance, canonical URLs, exact fetch locations and committed-byte SHA-256 hashes
- expose the selected assets through `@soul/assets` while keeping full packs as audited candidates rather than shipping everything

## Acceptance

- only assets with explicit redistribution-compatible licensing are materialized
- no app imports another app; shared asset metadata remains under `packages/assets`
- binary assets are obtained by a one-shot repository materializer and the temporary workflow is removed after use
- Phase 3 changes remain limited to shared asset storage/catalog/tests/docs
- `main` and Production are not modified
