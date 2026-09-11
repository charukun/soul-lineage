# MasterCharacter production simulator

## Scope and recovery

Sendagaya_Shino remains the audited MasterCharacter from merged PR #26. The recovery of PR #42 retains its committed production adapter, genetics/session module and tests; it does not re-import the original ZIP. Work branch: `feat/master-character-simulator`. The recovered source is reconciled with develop `c3184b9aacd3e0ab566e9f2589799a293119b4a8`.

The opt-in entry is `apps/rinne/characters.html`, built alongside the Rinne app by the existing build. The simulator loads repository-local `simulator/assets/SHINO_review.vrm` only after complete GLB, exact content hash and license validation. No external model resources or game saves are accessed.

## Controls

- Deterministic seed cohorts; 1/6/12/30 displayed actors; selected-only inspection; two-parent inheritance comparison.
- Reversible age, body, hair, eye and skin gene inspection; existing outfit palette variants. These are variations of the existing complete outfit, not new clothing meshes, species or sex-specific models.
- Front/back/side/face/overview camera presets and touch orbit/pinch; PNG capture.
- Per-instance expressions and blink; secondary motion OFF, automatic LOD or full population updates. Geometry and textures remain shared while state is isolated.
- Bounded JSON import/export of canonical records, settings and notes. Imported performance metadata is not trusted as acceptance evidence.
- Visible frame-time diagnostics include slow frames; background-tab time is excluded. The first 60 visible frames warm up; the next 600 form a sliding sample. Drawn and secondary-updated actor counts are explicit.

Pose controls are diagnostic joint movement, not the final motion work from parallel PR #23. This renderer uses the existing raw-bone/PBR path and standard sphere/capsule spring colliders; it is not a complete MToon/VRM implementation.

## Verification and delivery

Affected fast validation, real asset metadata/hash tests, rig isolation/recycling tests, cohort/session tests and UI wiring checks are required before Ready. See PR #42 for exact commit and actual CI results. `character-review-ui.test.mjs` tests source contracts, not GPU rendering. Browser/Pixel Fold performance, final visual approval and real multi-peer replication remain separate acceptance checks.

Implementation ends at a fast-verified Ready PR. Existing Integration owns develop merge and DEV publication. A branch build or Ready PR is not proof of public deployment. After Integration publishes, the entry is `characters.html` beneath the DEV Rinne app URL.

No changes to main, Production, parallel motion/VFX PR #23, game rules, lifecycle timing, save identifiers, network authority, CI/CD or Integration policy are included.
