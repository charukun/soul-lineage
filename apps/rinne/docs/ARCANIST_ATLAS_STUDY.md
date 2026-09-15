# Arcanist Atlas Study

Status: `VISUAL REVIEW CANDIDATE / BLOCKOUT`

## Purpose

This is one independent character-modeling study for Visual Review Lab. It deliberately avoids Shino and does not replace the existing `arcanist.reference.v1` preset. The study is derived from the repository reference `docs/characters/references/npc-role-set/arcanist.avif` so the existing runtime reference and this candidate can be compared side by side.

## Source-of-truth boundary

- Identity reference: `docs/characters/references/npc-role-set/arcanist.avif`.
- Existing baseline: `arcanist.reference.v1` remains unchanged.
- Candidate ID: `arcanist.atlas-study.v1`.
- Runtime modeling mode: `runtime-procedural`.
- Production stage: `BLOCKOUT`.
- Production ready: `false`.
- Gameplay ownership is unchanged. Staff, book, scroll tubes and satchel are presentation-only review geometry.

The worker environment used for this batch does not provide Blender, so this candidate must not be described as DCC `PRIMARY`, production art, or a finished GLB/VRM. Its purpose is to test silhouette construction, layered costume design, face/hair readability, prop integration and detail hierarchy using the shared runtime model path. A later DCC pass can use the visual review result as guidance without inheriting a false production claim.

## Modeling target

Preserve the refined scholar / magic-role identity from the reference while making the silhouette more authored than the baseline blockout. The candidate adds a layered shoulder mantle and collar, robe front panels and sash, modeled cuffs, longer side hair locks and tie, complete glasses bridge/temples, scroll tubes and satchel, plus a more structured staff head and book treatment.

Large-form readability takes priority over micro-detail. The model should still read cleanly from front, three-quarter, side and back views and remain attached to the audited shared humanoid rig so the existing Lab motion controls continue to work.

## Review contract

Visual Review Lab must expose both `ARCANIST` and `ARCANIST_ATLAS_STUDY` as separate selectable presets. The candidate uses the same Arcanist reference portrait and source Shino motion rig, but its additional geometry comes from `packages/rendering/src/arcanist-atlas-study.js`, not from duplicated Lab-only mesh code.

Acceptance for this batch is limited to:

- selectable candidate without replacing the baseline;
- distinct silhouette and layered costume/prop geometry;
- shared rig motion compatibility;
- cleanup of all candidate-owned geometry/materials on preset disposal;
- successful Review Lab build/deploy checks;
- human visual review remains pending.
