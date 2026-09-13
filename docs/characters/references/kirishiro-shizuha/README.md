# 霧白静刃 / Kirishiro Shizuha

- Reading: `きりしろ しずは`
- Romanization: `Kirishiro Shizuha`
- Reference ID: `kirishiro-shizuha`
- Overview sheet: `kirishiro-shizuha-character-reference-sheet-v1.webp`
- Current game adapter save ID: `silver-reaper` (retained for existing-save compatibility)

This directory stores the canonical character reference for Kirishiro Shizuha, the silver-haired scythe wielder introduced from the supplied gameplay-video visual target and currently prototyped in 尽喰廻遊.

## Reference contract

Use this directory as one reference set. The overview and detailed panels together cover the front / side / back turnaround, face, weapon, action silhouette, color/material direction, and costume/accessory detail needed for later modelling and visual review.

- `kirishiro-shizuha-character-reference-sheet-v1.webp` — overview
- `kirishiro-shizuha-turnaround-v1.webp` — front / side / back
- `kirishiro-shizuha-face-v1.webp` — face and expression
- `kirishiro-shizuha-weapon-v1.webp` — scythe
- `kirishiro-shizuha-action-v1.webp` — action silhouette
- `kirishiro-shizuha-materials-v1.webp` — palette / materials
- `kirishiro-shizuha-details-v1.webp` — costume / accessory details

The old `video-character-001` observation sheet is intentionally not retained as a parallel reference. Its direct-frame-crop approach caused ambiguity about which sheet should be used for modelling, so this reference set replaces that track.

## Implementation boundary

This reference set is the current visual/design target. Repository code and approved runtime assets remain the implementation source of truth.

The existing 尽喰廻遊 prototype still reuses the current MasterCharacter rig and separately authored wardrobe / scythe geometry. Do not treat the reference art itself as an audited runtime model, a Character Workshop CURRENT MASTER, or proof that every illustrated costume detail is already implemented.

When the runtime model is upgraded, compare it against this reference in the normal character modelling and Visual Review flow, then update the reference if an approved implementation intentionally changes the design.
