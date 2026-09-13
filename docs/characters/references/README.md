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

## Kirishiro Shizuha / 霧白静刃

`kirishiro-shizuha/kirishiro-shizuha-character-reference-sheet-v1.webp` is the overview sheet for 霧白静刃 (Kirishiro Shizuha), the silver-haired scythe wielder currently prototyped in 尽喰廻遊. The same directory also contains higher-density turnaround, face, weapon, action, material, and detail panels for modelling and visual review.

The previous `video-character-001` observation-sheet track has been retired. Keep one reference identity for this character and use the approved name `霧白静刃 / Kirishiro Shizuha` in user-facing surfaces and design documentation.

## NPC Role Concept Set

`npc-role-set/` stores a coordinated set of role and age reference sheets for expanding the visual language of generated village and human NPCs.

These sheets are `CONCEPT TARGET / NOT IMPLEMENTED` unless a detail is already covered by the current MasterCharacter or modular appearance contracts. They are review targets for future authored parts and generation rules, not proof that the depicted hair, clothing, body shape, props, armor, weapons, or accessories exist in runtime today.

The repository stores compact AVIF review previews. The original generated high-resolution images are production-source inputs outside this commit, so these previews must not be described as original/source assets.

Initial set:

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

When adopting details from these sheets, classify each adopted element as `IMPLEMENTED MODULAR PARTS`, `PROPOSED PARTS`, or `GAME EQUIPMENT` before connecting it to runtime generation.
