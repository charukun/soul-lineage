# NPC Role Concept Set

Status: `CONCEPT TARGET / NOT IMPLEMENTED`

Generated/reviewed: 2026-09-13

## Purpose

This set expands the visual design space available to future Character Workshop authoring, MURAAAAAAA residents, and human NPC generation. It intentionally covers age and role silhouettes that are weak when every character is derived only from Shino-like adult proportions and the initial modular kit.

Implementation truth remains the audited MasterCharacter plus the current `packages/characters` and `packages/rendering` contracts. A picture in this directory does not make a depicted part available at runtime.

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

## Adoption boundary

Before using a detail in runtime, classify it explicitly:

- `IMPLEMENTED MODULAR PARTS`: already exists in the current audited/modular implementation.
- `PROPOSED PARTS`: visual target that still requires authored geometry/material/rig work.
- `GAME EQUIPMENT`: gameplay-owned equipment whose appearance must follow that game's equipment contract rather than silently becoming a cosmetic body part.

The exact faces, haircuts, garments, child/elder body proportions, tools, armor, weapons, bags, books, staffs, bows and other props shown here are not automatically implemented. Use Character Workshop rendered review to decide what should be authored next, then validate the resulting runtime geometry separately.

## Source handling

The files in this directory are compact AVIF review previews derived from generated 1448×1086 concept sheets. They are repository references, not the original high-resolution source images. Do not infer production texture resolution or model dimensions from these previews.
