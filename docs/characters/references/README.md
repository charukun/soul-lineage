# Character References

This directory stores visual character reference sheets used to keep concept art, MasterCharacter implementation, and Character Workshop review aligned.

## Rules

- Repository code and approved model assets remain the implementation source of truth.
- A reference sheet must clearly separate `CURRENT MASTER`, `IMPLEMENTED MODULAR PARTS`, `RUNTIME REFERENCE MODEL`, `PROPOSED PARTS`, and `GAME EQUIPMENT` when those categories apply.
- Source-observed references for characters that are not implemented yet must be marked `SOURCE OBSERVED / NOT IMPLEMENTED`, and must distinguish visible evidence from unresolved details.
- Do not present speculative props, body features, dimensions, or equipment as final-art approved.
- Update the reference sheet or runtime descriptor when an approved model or modular-part contract changes materially.
- New characters should use the same structure so references can be generated, implemented and reviewed as a consistent production set.

## Shino

`shino/shino-character-reference-sheet-v2.png` is the repository reference sheet for the new Shino visual target. `shino.reference.v2` is now a dedicated runtime reference model on the common audited humanoid rig and is selectable in Character Workshop / Visual Review Lab. The legacy audited VRM remains the rig/animation source contract; selecting the reference model hides its render meshes and uses the dedicated Shino reference geometry instead.

## Video Character 001

`video-character-001/video-character-reference-sheet-v1.webp` captures only the identity cues visible in the supplied gameplay video: long silver hair, a dark silhouette, an oversized ornate scythe, and low dynamic combat posture. See `video-character-001/README.md` for frame times, unresolved details, and the implementation boundary.

## NPC Role Concept Set

`npc-role-set/` stores a coordinated set of role and age reference sheets for expanding the visual language of generated village and human NPCs.

All ten sheets now have `RUNTIME REFERENCE MODEL` coverage through `packages/characters/src/reference-models.js` and `packages/rendering/src/master-character-reference.js`. They are selectable in Character Workshop / Visual Review Lab as distinct 3D characters with reference-specific proportions, hair, clothing, gear and props. Rendered visual approval against each sheet remains a separate gate before final-art sign-off.

The repository stores compact AVIF review previews. The original generated high-resolution images are production-source inputs outside this commit, so these previews must not be described as original/source assets.

Runtime set:

- `child-boy.avif`
- `child-girl.avif`
- `elderly-man.avif`
- `elderly-woman.avif`
- `guard.avif`
- `knight.avif`
- `blacksmith.avif`
- `laborer.avif`
- `hunter.avif`
- `arcanist.avif`

Gameplay ownership remains separate: a sword, bow, staff, tool, bag or other prop on a runtime review model does not by itself add that item to inventory/combat systems.
