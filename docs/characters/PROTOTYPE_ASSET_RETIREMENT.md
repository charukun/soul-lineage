# Prototype character asset retirement

Character experiments are useful, but unfinished character geometry must not remain discoverable as an active production candidate after the experiment is abandoned.

## Active-tree rule

The active character tree may contain review assets only when a current runtime, audit, production manifest, or reproducible review workflow still depends on them. Superseded blockouts, one-off refinement scripts, intermediate exported models, and abandoned DCC experiments belong in Git history rather than beside current character sources.

Removing a prototype from the active tree does not erase its provenance. Git history is the archive. Do not keep duplicate legacy assets or version-by-version authoring scripts merely as an informal backup.

## Runtime promotion rule

A character asset is selectable by gameplay/default production resolution only when it carries a valid `character-production` v2 manifest and that manifest passes the full `RUNTIME_READY` gate. Self-declared `productionStage` / `productionReady` flags without the manifest and its evidence are not sufficient.

`REFERENCE`, `BLOCKOUT`, `PRIMARY`, `SECONDARY`, `DEFORMATION`, `MOTION`, and `POLISH` assets may still be loaded by an explicitly review-only surface that preserves and displays the real production stage. Review tooling must opt in explicitly to non-ready assets rather than inheriting them through a generic production/default path.

## Retirement procedure

When retiring an abandoned prototype:

1. Find all runtime, test, manifest, documentation, workflow, and authoring-script references before deleting files.
2. Replace active default paths with the current canonical reviewed source, or remove the feature if no valid successor exists.
3. Delete superseded exported assets and one-off build/refinement scripts from the active tree once no current reproducible workflow requires them.
4. Remove stale production manifests so inventory/check tooling cannot rediscover the retired prototype as a current candidate.
5. Add regression coverage that prevents manifest-less or non-`RUNTIME_READY` assets from silently becoming gameplay/default production selections.
6. Preserve license/provenance for any surviving canonical asset.

For Shino, the retired `shino.reference.v2` experiment is historical only. The audited `SHINO_review.vrm` remains the current MasterCharacter review/runtime source until a future candidate independently completes the production pipeline and explicit visual approval.
