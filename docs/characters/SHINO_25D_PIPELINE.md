# しのちゃん 2.5D draft pipeline

## Scope and acceptance

Visual Review Lab -> `/review-hybrid-25d` -> しのちゃん素材工房 -> export `shino.character25d.json` -> RINNE DEV `/?character25d=shino` -> import the same bundle and place a visual-only village guest.

The portable raster manifest and optional browser/Three adapters live under `packages/assets/src`, exposed through `@soul/assets/sprite25d`, `/browser` and `/three`. Both apps already depend on that package. No cross-workspace relative import, new dependency, lockfile churn or workflow is needed. These local-draft APIs are separate from approved character production and Asset Origin registries.

- Preserve the existing split/overlay/camera/billboard comparison and its generic image scratchpad.
- Preserve original reference bytes and hashes; support sheet/front/quarter/side/back slots, a transparent pose and eight directions for Idle/Walk.
- Crop without scaling or repainting. White removal is optional and off by default. It removes edge-connected near-white pixels, which can include white costume details; compare with the unchanged original.
- Export the standalone pose raster as well as the portable bundle.
- Keep draft images on the user's device. No generator, paid service, external asset URL or automatic image upload is introduced.
- Validate imported raster signatures, byte lengths, SHA-256, decoded dimensions/alpha, crop lineage and non-empty atlas cells. Reject cyclic crop lineage and metadata/bytes disagreement.
- Do not change player, life, combat, family, collision or save authority. The guest is opt-in, DEV/local only, and fails closed in Production or an unknown environment.
- No current Shino reference image has been resolved for this task. The available conversation image is an Actions infographic, not a character reference. Display the missing source honestly; never substitute retired Shino, the comparison model or an invented face.
- Identity and license remain pending. This local-draft bridge does not grant visual approval, RUNTIME_READY, Production readiness or completed eight-direction art.

## Format

`rinne.character25d/v1`, character `rinne.shino.25d.v1`, stores raster records keyed by SHA-256. Every record has byteLength, MIME type, dimensions, transparency and provenance. Local uploads retain unverified author/license status; reference crops retain the source hash, pixel rectangle and white-removal choice. A crop may itself have a source; parent images remain retained when unused previews are pruned.

Animation atlases have eight equal-height rows in S/SW/W/NW/N/NE/E/SE order and 1-32 equal-width columns, at 1-24 FPS. Missing clips may display the explicitly provided pose, clearly labelled as a static fallback. They are not generated, mirrored or reported as Walk. A common pivot and world height preserve grounding across cells. The shared actor selects directions relative to camera/actor yaw, uses half-pixel UV insets and owns/disposes its textures and geometry.

Limits: 8 MiB per image, 32 MiB image bytes per bundle, 24 records, 4096 maximum edge, 8M displayed pixels, 46 MiB JSON import. Bundle metadata is checked before decoding, and raster signatures are checked before browser image loading.

## RINNE temporary guest

The normal route never imports the guest module. The explicit query opens a collapsible import panel, and a verified bundle creates a stationary billboard near the player at an unblocked village position. The guest is hidden during title preview, interiors, frontier and ended lives. The summon button relocates it beside the player; no NPC, movement, conversation, battle or save entity is created. Temporary placement uses the gameplay position's ground height, never the carried infant's raised model position.

## Distribution and future 3D

IndexedDB (`rinne-character25d-drafts-v1`) is isolated from game saves and is not shared between Review and RINNE origins. Export/import is the explicit transport. These bundles are local authoring artifacts, not remotely hosted runtime assets. Permanent adoption must use the existing self-owned Asset Origin, verified license/provenance and character registry. `model3d:null` reserves a next-stage association; actual 3D production must satisfy the existing DCC/character gates.

## Validation and evidence boundaries

`tests/shino25d-pipeline.test.mjs` covers blank slots, static fallback, direction layout, limits, malformed input, crop lineage, hash/decoded-metadata checks, empty atlas cells, ground pivots, UV playback, resource disposal, production isolation and declared package exports. Its synthetic raster fixtures and mocked browser/Three ports are unit-test inputs, not Shino art or visual-approval evidence.

Use existing hosted exact-head Astra validation for the focused tests and affected Review/RINNE builds before Ready/merge. Do not modify workflows, Fast DEV checks, build lifecycle or quality gates. `Browser-Playtest: rinne` selects the existing browser evidence lane; real browser evidence and reference fidelity must not be inferred from unit/build success. Main/Production are out of scope.

## Detachable authoring support

Capability gap: a reference image previously had no portable path into an opt-in in-game 2.5D preview. Dependencies are browser raster decoding/canvas, IndexedDB, the existing Three renderer and review route. Once approved materialized sprites are selected through the normal character registry, the temporary guest and local draft bridge can be removed without replacing the portable metadata or shared sprite renderer.
