# しのちゃん 2.5D draft pipeline

## Scope and acceptance

Recover the previously authored pipeline in `apps/review`, `apps/rinne` and `packages/characters` against current develop. Delivery to this repository is authorized by the user's implementation request and `docs/DELIVERY_AUTHORIZATION.md`.

Visual Review Lab -> `/review-hybrid-25d` -> しのちゃん素材工房 -> export `shino.character25d.json` -> RINNE DEV `/?character25d=shino` -> import the same bundle and place a visual-only village guest.

- Preserve the existing split/overlay/camera/billboard comparison and its separate generic image scratchpad.
- Preserve original reference bytes and hashes, support sheet/front/quarter/side/back slots, transparent pose and eight directions for Idle/Walk.
- Keep draft images on the user's device. No external generator, paid service or automatic upload is introduced.
- Validate imported raster bytes, dimensions, alpha, hashes, crop lineage and atlas cells. Never execute imported content or load an external asset URL from a bundle.
- Do not change player, life, combat, family, collision or save authority. The guest is opt-in and disabled in Production.
- No original Shino reference bytes have been resolved for this task. Display that honestly; never substitute an old/retired Shino, the 3D comparison model or an invented face.
- Pending identity and license review remain pending. This local-draft bridge does not grant visual approval, RUNTIME_READY, Production readiness or completed eight-direction art.

## Format

`rinne.character25d/v1`, character `rinne.shino.25d.v1`, stores immutable raster records keyed by SHA-256. Every record has byteLength, MIME type, dimensions, transparency and provenance. Local uploads retain unverified author/license status; reference crops retain the source hash, pixel rectangle and optional border-white-removal choice.

Animation atlases have eight equal-height rows in S/SW/W/NW/N/NE/E/SE order and 1-32 equal-width columns, at 1-24 FPS. Missing clips may display the explicitly provided pose, clearly labelled as a static fallback; they are not generated, mirrored or reported as Walk. A common pivot and world height preserve grounding across cells.

The original reference remains unchanged. Optional white removal is off by default and removes only edge-connected near-white pixels; it may affect white costume details and requires comparison with the original. Identical source bytes are deduplicated.

## Distribution and future 3D

IndexedDB is isolated from game saves and is not shared between Review and RINNE origins. Export/import is the explicit transport. These bundles are local authoring artifacts, not remotely hosted runtime assets. Permanent adoption must use the existing self-owned Asset Origin, license/provenance checks and character registry. `model3d:null` reserves a next-stage association; actual 3D production must satisfy the existing DCC/character gates.

## Validation and detachable support

Use the existing hosted exact-head Astra validation for focused manifest/import/renderer tests and affected Review/RINNE builds. Do not modify workflows, Fast DEV checks, build lifecycle or quality gates. Browser/art evidence and real-reference fidelity must be distinguished from unit/build success.

Capability gap: a reference image currently has no portable path into an opt-in in-game 2.5D preview. Dependencies: browser raster decoding/canvas, IndexedDB, existing Three renderer and review route. Once approved materialized sprites are selected through the normal character registry, the temporary guest and local draft bridge can be removed without replacing the portable metadata or shared sprite renderer.
