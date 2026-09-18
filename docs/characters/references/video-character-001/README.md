# Video Character 001

Status: `SOURCE OBSERVED / DEMON ADAPTER PROTOTYPE`

This folder records a character reference extracted from the user-provided gameplay video `1000003106.mp4`. The character has not been assigned a canon name in the repository, so the neutral production ID `video-character-001` is used until a name is approved.

The demon app now has a selectable appearance prototype linked to this reference ID
(`silver-reaper`, provisional display name 白銀の鎌姫). Its face uses Shino's existing
rig and its wardrobe/weapon geometry is separately authored. This is not an audited
CURRENT MASTER or Character Workshop preset. Designed details, validation evidence
and remaining runtime checks are recorded in
[`PLAYABLE_CHARACTERS.md`](../../../../apps/demon/docs/PLAYABLE_CHARACTERS.md).

## Reference sheet

- `video-character-reference-sheet-v1.webp`
- 640 × 480 WebP preview
- Source evidence frames: 10.4s, 13.4s, 14.6s, 15.2s
- SHA-256: `cd58632ac7dfcbb3679e3c4fb9ed5d3ea1698f94ecb164c255b1b116c74115a6`

The sheet intentionally uses direct frame crops instead of invented turnaround views. A clean front/side/back turnaround cannot be recovered from this video alone.

## Observed from the video

- Very long light / silver hair with a strong trailing silhouette.
- Predominantly dark outfit with pale hair / upper-body contrast.
- Dark legwear / boots; the lower-body silhouette reads slim and mobile.
- Oversized ornate scythe-like pole weapon with a long shaft and curved blade.
- Hair and weapon create most of the character's silhouette width.
- Combat posture is often low, forward-weighted, and dynamic.

## Unresolved

Do not invent these details from this reference:

- exact face, eyes, and expression design;
- garment topology, back construction, and material layers;
- small accessories hidden by motion, hair, or VFX;
- exact weapon reverse side, attachment method, and dimensions;
- canonical height, body measurements, or exact color values.

## Implementation boundary

This reference is visual evidence only. It is **not** a `CURRENT MASTER`, audited model, modular-part contract, or game-ready asset.

Do not register it as an implemented Character Workshop reference preset until a real character asset/profile exists and has passed the repository's MasterCharacter, provenance/license, deformation, runtime, and performance checks. A future implementation may use this sheet and the original video as visual targets, but unseen details must be explicitly designed and reviewed rather than inferred as facts.

The raw screen recording is not committed here. It contains the surrounding social/app UI and is retained only as the source supplied for this task.
