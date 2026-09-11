# MasterCharacter production simulator

## Scope and recovery

Task: complete the integrated Sendagaya_Shino production foundation and provide a smartphone-friendly simulator for the resulting characters. Implementation base: develop `5dc6c8fa0a7662d0043c2753e37fe079d7806d34`; foundation PR #26 is already merged. Do not re-import its ZIP or replace existing games.

Work branch: `feat/master-character-simulator`. This document is an early recovery checkpoint, not a completion claim. Keep the PR Draft until implementation and affected fast verification pass.

Planned changes are confined to `apps/rinne/characters.html`, its review modules/tests, and the shared `packages/rendering` MasterCharacter adapter/tests. Reuse the audited repository-local `SHINO_review.vrm`, existing canonical character/genetics records and the 30-slot geometry/texture-sharing pool.

The simulator will expose reproducible cohorts, single/crowd inspection, age/body/palette differences, per-instance expressions and secondary-motion diagnostics, touch camera controls, and bounded JSON export/import. These are appearance variations of the existing complete outfit, not newly authored clothing meshes or a replacement gameplay/save/network system.

The parallel `work/visual-review-lab-v2` / PR #23 motion and VFX review work remains untouched. No changes to main, Production, game rules, lifecycle timing, saves, network authority, CI/CD or automatic-Integration policies.

## Delivery boundary

Implementation ends at an affected fast-verified Ready PR to develop. Integration owns merging and DEV publication. The existing entry is `characters.html` alongside the Rinne app. Do not describe a branch build or Ready PR as already published DEV.

Pixel Fold hardware performance, final visual approval and real multi-peer replication remain separate acceptance checks. A synthetic rig test or software-GPU browser run does not prove those checks.
