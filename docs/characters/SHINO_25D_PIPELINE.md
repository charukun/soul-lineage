# しのちゃん 2.5D draft pipeline

## Scope and acceptance

Visual Review Lab -> `/review-hybrid-25d` -> 画像を1枚アップロード -> 自動抽出 -> 共存ビュー -> `RINNEで仮登場`。

The portable raster manifest and optional browser/Three adapters live under `packages/assets/src`, exposed through `@soul/assets/sprite25d`, `/browser` and `/three`. Both apps already depend on that package. No cross-workspace relative import, new dependency, lockfile churn or workflow is needed. These local-draft APIs are separate from approved character production and Asset Origin registries.

- Normal use is one image upload. The browser derives front/side/back candidates and a transparent pose locally, then immediately shows it in the coexistence view.
- Manual crop, animation atlas and bundle controls remain only under the advanced troubleshooting disclosure.
- Preserve original reference bytes and hashes; support sheet/front/quarter/side/back slots, a transparent pose and eight directions for Idle/Walk.
- Crop without scaling or repainting. Automatic background removal is local heuristic processing, not identity synthesis.
- Keep draft images on the user's device. No generator, paid service, external asset URL or automatic upload to a third party is introduced.
- Validate imported raster signatures, byte lengths, SHA-256, decoded dimensions/alpha, crop lineage and non-empty atlas cells. Reject cyclic crop lineage and metadata/bytes disagreement.
- Do not change player, life, combat, family, collision or save authority.
- Identity and license remain pending. This local-draft bridge does not grant visual approval, RUNTIME_READY, Production readiness or completed eight-direction art.

## Format

`rinne.character25d/v1`, character `rinne.shino.25d.v1`, stores raster records keyed by SHA-256. Every record has byteLength, MIME type, dimensions, transparency and provenance. Local uploads retain unverified author/license status; reference crops retain the source hash and pixel rectangle.

Animation atlases have eight equal-height rows in S/SW/W/NW/N/NE/E/SE order and 1-32 equal-width columns, at 1-24 FPS. Missing clips may display the explicitly provided pose, clearly labelled as a static fallback. They are not generated, mirrored or reported as Walk.

## RINNE temporary guest

The RINNE side has no visible 2.5D debug panel, file picker, summon button or persistent draft UI. The guest bridge activates only for the explicit DEV/local query created by Visual Review Lab and only when a one-time `spriteTransfer` token and opener are present. The Lab sends the verified bundle through the current opener session; RINNE verifies it again and places the stationary visual guest automatically near the player when the village is visible.

The transfer is session-only. It does not create an NPC, conversation, battle participant, family member, save entity or IndexedDB draft on the RINNE origin. Directly opening the query without the Lab transfer does nothing visible.

## Distribution and future 3D

Review-side IndexedDB (`rinne-character25d-drafts-v1`) is isolated from game saves. Bundle export/import remains available only in advanced troubleshooting. Permanent adoption must use the existing self-owned Asset Origin, verified license/provenance and character registry. `model3d:null` reserves a next-stage association; actual 3D production must satisfy the existing DCC/character gates.

## Validation and evidence boundaries

`tests/shino25d-pipeline.test.mjs` covers manifest integrity, directional layout, malformed input, crop lineage, hash/decoded-metadata checks, atlas cells, ground pivots, UV playback, resource disposal, production isolation and declared package exports. Synthetic raster fixtures are unit-test inputs, not visual evidence.

Routine Fast DEV uses exact-source syntax/consistency checks. Browser/art fidelity is a separate visual observation and must not be inferred from source validation.

## Detachable authoring support

Capability gap: a reference image previously had no short path into an opt-in in-game 2.5D preview. Dependencies are browser raster decoding/canvas, the existing Three renderer and review route. Once approved materialized sprites are selected through the normal character registry, the temporary guest bridge and local draft tooling can be removed without replacing the portable metadata or shared sprite renderer.
