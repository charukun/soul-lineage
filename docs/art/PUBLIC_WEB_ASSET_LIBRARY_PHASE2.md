# Public Web Asset Library Phase 2

Task: materialize the next safe public-web asset batch for Rinne, MURAAAAAAA and 尽喰廻遊.

Starting develop: `44198654a7b2f4c5453a9ba7cdaaf8edf2976876`.

Depends on the shared public-web catalog introduced by PR #483. This follow-up must preserve provenance, license text and immutable hashes where available, and it must not make runtime code depend on mutable third-party URLs.

## Scope

- Materialize a compact CC0 audio set for combat/UI feedback.
- Promote already-audited Kenney particle textures into the shared catalog without duplicating existing repository-local copies when they can be reused.
- Add a compact CC0 PBR/material sample set suitable for medieval ground/walls/wood, favoring mobile-friendly resolutions.
- Add tests/manifests that distinguish repository-local `MATERIALIZED` assets from remote audited candidates.
- Keep all assets available to `rinne`, `village` and `demon` through shared package boundaries; app-specific adoption remains separate.

## Acceptance

- Every imported third-party file has explicit provider/license/provenance metadata.
- Stable archive/file hashes are recorded when the provider exposes immutable bytes; otherwise the imported file's SHA-256 is recorded locally with canonical source URL and audit date.
- No paid asset, unclear redistribution term, mutable runtime URL, Production publication or main change.
- Fast validation covers catalog integrity and local-file existence; asynchronous CI/Integration remains outside this worker.
