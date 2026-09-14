# Character Production Pipeline v2

## Implementation scope

This change upgrades character production from one-shot runtime geometry generation into a staged production workflow. Character work must move through explicit `REFERENCE -> BLOCKOUT -> PRIMARY -> SECONDARY -> DEFORMATION -> MOTION -> POLISH -> RUNTIME_READY` stages. A procedural primitive/blockout model is review material only and must not be described, catalogued or promoted as a production-ready character.

The implementation will add an executable production-gate contract, Blender/DCC handoff metadata, repeatable Visual Review/Motion QA requirements and runtime acceptance evidence. Existing MasterCharacter provenance/licensing, gameplay ownership, Motion QA, Character Workshop and Visual Review Lab boundaries remain authoritative.

## Acceptance

- Astra/implementation workers can determine the current character-production stage from repository data instead of prose alone.
- `BLOCKOUT` cannot pass the production-ready gate.
- promotion to `RUNTIME_READY` requires evidence for reference coverage, primary/secondary forms, deformation poses, relaxed/combat motion coverage, multi-view visual review and runtime/performance checks.
- DCC/Blender is the preferred high-fidelity modeling path; Three.js primitive generation remains allowed for blockout and diagnostics only.
- numeric QA never substitutes for human/visual approval.
- current reference-derived primitive characters are classified as blockouts until they are rebuilt and approved through this pipeline.
