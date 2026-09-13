# Character References

This directory stores visual character reference sheets used to keep concept art, MasterCharacter implementation, and Character Workshop review aligned.

## Rules

- Repository code and approved model assets remain the implementation source of truth.
- A reference sheet must clearly separate `CURRENT MASTER`, `IMPLEMENTED MODULAR PARTS`, `PROPOSED PARTS`, and `GAME EQUIPMENT` when those categories apply.
- Source-observed references for characters that are not implemented yet must be marked `SOURCE OBSERVED / NOT IMPLEMENTED`, and must distinguish visible evidence from unresolved details.
- Do not present speculative props, body features, dimensions, or equipment as implemented.
- Update the reference sheet when an approved model or modular-part contract changes materially.
- New characters should use the same structure so references can later be generated and reviewed as a consistent production set.

## Shino

`shino/shino-character-reference-sheet-v2.png` is the first repository reference sheet for the current Shino-based MasterCharacter workflow. It is a review/reference image, not a replacement for `packages/characters`, `packages/rendering`, or the audited VRM asset contract.

## Video Character 001

`video-character-001/video-character-reference-sheet-v1.webp` captures only the identity cues visible in the supplied gameplay video: long silver hair, a dark silhouette, an oversized ornate scythe, and low dynamic combat posture. See `video-character-001/README.md` for frame times, unresolved details, and the implementation boundary.

## NPC Role Concept Set

`npc-role-set/` stores a coordinated set of role and age reference sheets for expanding the visual language of generated village and human NPCs.

These sheets are `CONCEPT TARGET / NOT IMPLEMENTED` unless a detail is already covered by the current MasterCharacter or modular appearance contracts. They are review targets for future authored parts and generation rules, not proof that the depicted hair, clothing, body shape, props, armor, weapons, or accessories exist in runtime today.

Initial set:

- `child-boy.png`
- `child-girl.png`
- `elderly-man.png`
- `elderly-woman.png`
- `guard.png`
- `knight.png`
- `blacksmith.png`
- `laborer.png`
- `hunter.png`
- `arcanist.png`

When adopting details from these sheets, classify each adopted element as `IMPLEMENTED MODULAR PARTS`, `PROPOSED PARTS`, or `GAME EQUIPMENT` before connecting it to runtime generation.
