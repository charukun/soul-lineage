# Character Asset License Policy

## Purpose

Character model assets used by 輪廻転焦, village, demon or shared character tooling must be suitable for commercial distribution without model-specific commercial-use conditions.

## Allowed character model sources

New or active game-facing character model assets must satisfy one of these source classes:

- RINNE-authored original assets whose model, rig, textures and embedded data do not inherit third-party conditional character-model terms.
- Third-party assets licensed under CC0-1.0, with pinned provenance and repository-local verification.

A permissive commercial-use clause with attribution, redistribution, field-of-use, embedded VRM, character-license or other model-specific conditions does not satisfy this policy.

Discovery through Fab, Blendkit, Sketchfab, Quaternius, CGTrader or another catalog does not make an asset eligible. `CHARACTER_ASSET_SOURCING.md` defines where workers should search first; this policy still decides whether a discovered candidate may become an active game-facing character asset.

## Retired conditional models

Conditional third-party character models are retired from active runtime, review candidate lists and new character production. Existing historical provenance may remain in Git history or documentation, but retirement must prevent the asset from being selected, materialized or shipped as an active candidate.

This includes the existing VRoid A/B/C review models, Tsukuyomi-chan review model and Sendagaya_Shino-derived runtime/review models while they retain their conditional model or embedded-license dependency.

## Derived and carrier-rig assets

RINNE-authored surfaces do not become license-clean merely because the visible geometry is original. If a runtime asset retains a rig, embedded metadata, textures or other model data derived from a conditional character asset, it is not eligible for Production under this policy until that dependency is removed.

Current DCC assets that use the Sendagaya_Shino carrier rig may remain as non-Production migration evidence, but must not be promoted to `RUNTIME_READY` until re-rigged to a RINNE-authored or CC0 foundation and their provenance is updated.

## Default foundation

`kaykit.adventurers.v1` remains the default external character foundation because its pinned source is recorded as CC0-1.0. New game-facing character work should prefer that foundation or fully RINNE-authored assets.

When a new role needs a different model, use the catalog-first acquisition flow in `CHARACTER_ASSET_SOURCING.md` before falling back to generated geometry. Only candidates that satisfy this license policy may progress as active imported character assets.

## Enforcement

Character production and review tooling must fail closed when a model is classified as conditional-commercial. A retired conditional model must not be reintroduced as a default, fallback or comparison candidate merely because it technically loads or its license permits commercial use under conditions.

`RUNTIME_READY` still requires the existing Character Production evidence, visual approval and runtime-performance gates in addition to this license policy.
