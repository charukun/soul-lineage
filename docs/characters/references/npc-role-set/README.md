# NPC Role Concept Set

Status: `RUNTIME 3D IMPLEMENTED / VISUAL QA REQUIRED`

Generated/reviewed: 2026-09-13
Runtime implementation: 2026-09-14

## Purpose

This set expands the visual design space available to Character Workshop authoring, MURAAAAAAA residents, and human NPC generation. It intentionally covers age and role silhouettes that are weak when every character is derived only from Shino-like adult proportions and the initial modular kit.

The reference sheets remain the visual targets. Runtime implementation is defined by `packages/characters/src/reference-models.js` and `packages/rendering/src/master-character-reference.js`: each sheet now has a selectable code-authored 3D model on the audited common humanoid rig, so it can be inspected with the existing Visual Review Lab camera, motion, expression, and Motion QA flow. These runtime models are implementation assets, but rendered visual approval is still required before treating a model as final art quality.

## Runtime mapping status

Character Workshop consumes these sheets as explicit reference archetypes. Each target maps only to runtime-safe age/role/modular channels.

Reference-derived modeling now has two layers:

- reusable modular parts, including `hair:bun` and `accessory:ribbon`;
- reference-only authored 3D overlays mounted to the existing humanoid bones for silhouette details that should not become save/schema slots.

The 3D overlay set covers the visible modeled forms for all ten targets: child cape/trousers/pouches and puffed sleeves/layered hem; elder beard/shawl/apron/pouches/hair wisps; guard tabard/greaves/emblem; knight plate/cape/crest; blacksmith gloves/tool belt; laborer cuffs/trousers/towel; hunter cloak/satchel/gaiters; and arcanist scroll tubes/satchel.

Surface-only cues are deliberately not counted as modeled geometry. Patchwork/floral patterns, weathering, blue-white tabard treatment, forge wear and arcane embroidery stay in `PROPOSED PARTS` until a reviewed material/texture treatment exists. Gameplay-owned tools, weapons and walking props stay in `GAME EQUIPMENT`.

The Workshop must continue to show three separate buckets for every target:

- `IMPLEMENTED MODULAR PARTS`: runtime-safe modular channels plus authored reference-only 3D details currently rendered for the target.
- `PROPOSED PARTS`: visible target details that still need authored geometry or material/texture work.
- `GAME EQUIPMENT`: details owned by gameplay/equipment contracts, not cosmetic body slots.

## Sheets

| Reference | Intent | Preview | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Child Boy | young child silhouette and practical village clothing | 500×375 | 5,011 | `4b98262eba21e6188992fcd01b8d5c03cb4af138f86e6f53d84b5d30c9e582f7` |
| Child Girl | young child silhouette with a distinct hair/clothing read | 500×375 | 4,700 | `dc312cb8be5c00a8339e0bf0d24f4c34dc1e81121fd2e0617c059b817c4ca6b5` |
| Elderly Man | aged face, posture, gray hair and layered village silhouette | 500×375 | 5,004 | `b5ac7b782b32eaa390c3e3df6816ffdb7e7907b5621da9011beb68fa39c93280` |
| Elderly Woman | aged face/posture plus bun, shawl and practical layering | 500×375 | 4,993 | `52af437910cc7ffe29b353f9b515b3c8e7aa78434134f1f02daff64870d69cd7` |
| Guard | village-defense silhouette and practical light armor target | 500×375 | 5,004 | `f0b02a92459427e8d45713c0dddbb960c7ab684e3f184ce3149752bad4437807` |
| Knight | higher-status armored silhouette and ceremonial mantle target | 500×375 | 5,069 | `6e39aa5c2f996ab776816f97cc0519bd921248a32dee79c521ff0a5f4f041e7f` |
| Blacksmith | sturdy artisan silhouette, apron and tool-bearing target | 500×375 | 4,924 | `da006da27c6e0afde55b10b518eb6faff0b71db486ea48afed061a0095573946` |
| Laborer | everyday worker silhouette, utility wear and pack/belt target | 500×375 | 5,193 | `dff0ed48bf378696977b4173ac083f67920d55e6792ad4078cb834225934668d` |
| Hunter | field-ready layered silhouette, quiver/satchel target | 500×375 | 4,818 | `cf0da4fd2823df028c7c940c85d492098b4245ef5aee3e7e8e04fc7ef4bfff4b` |
| Arcanist | refined scholar/magic silhouette, mantle and book target | 500×375 | 4,665 | `5930816e59424bcc17530ba9029d1231fb24ac88ee35ee5818f96e05e0978bd0` |

## Runtime coverage

All ten NPC sheets are registered in `CHARACTER_REFERENCE_MODELS` alongside the dedicated Shino reference model. Selecting one in Character Workshop / Visual Review Lab switches the selected actor from the source Shino render meshes to reference-specific runtime geometry while retaining the audited humanoid skeleton and animation contract.

The runtime models provide distinct age/body scaling, face proportions, hair silhouette, clothing geometry, role gear, palette, footwear and the reference-defining prop where applicable. Guard, Knight, Blacksmith, Hunter and Arcanist therefore no longer resolve to a Shino color variant in review.

## Adoption boundary

Reference-only overlay geometry is presentation-only. It follows the current humanoid bone hierarchy and shares cached immutable geometry, but it does not grant inventory, alter hitboxes, change combat stats, or add persistent character fields.

Before promoting a reference-only detail into a reusable character slot, classify and review it separately. Exact textures, material wear, printed patterns, weapons, tools and other gameplay props shown in the sheets are not implied by the geometry overlay.

- `RUNTIME REFERENCE MODEL`: implemented 3D review geometry on the common rig and selectable in Visual Review Lab.
- `FINAL ART APPROVED`: requires rendered human/Visual QA approval against the corresponding sheet.
- `GAME EQUIPMENT`: gameplay behavior and combat ownership remain with the game-specific equipment contract even when a visual prop is present on the review model.

A runtime reference model does not silently change gameplay stats, collision, inventory, combat rules, or the audited source VRM license contract. The exact concept-sheet illustration remains a target for visual refinement rather than a claim that the code-authored mesh is pixel-identical to the 2D art.

## Source handling

The files in this directory are compact AVIF review previews derived from generated 1448×1086 concept sheets. They are repository references, not the original high-resolution source images. Do not infer production texture resolution or model dimensions from these previews.
