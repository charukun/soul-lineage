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

The RINNE side has no visible 2.5D debug panel, file picker, summon button or persistent draft UI. The companion bridge activates only for the explicit DEV/local query created by Visual Review Lab and only when a one-time `spriteTransfer` token and opener are present. The Lab sends the verified bundle through the current opener session; RINNE verifies it again and places a session-only test companion near the player when the village is visible. The companion follows collision-checked movement, reads the player equipment state, and mirrors attack/hit/rest presentation. While the player is unarmed it keeps its own test sword and shield. The training-dummy strike also animates the companion.

The transfer is session-only. It does not create an NPC, conversation, battle participant, family member, save entity or IndexedDB draft on the RINNE origin. Directly opening the query without the Lab transfer does nothing visible.

## Distribution and future 3D

Review-side IndexedDB (`rinne-character25d-drafts-v1`) is isolated from game saves. Bundle export/import remains available only in advanced troubleshooting. Permanent adoption must use the existing self-owned Asset Origin, verified license/provenance and character registry. `model3d:null` reserves a next-stage association; actual 3D production must satisfy the existing DCC/character gates.

## Validation and evidence boundaries

`tests/shino25d-pipeline.test.mjs` covers manifest integrity, directional layout, malformed input, crop lineage, hash/decoded-metadata checks, atlas cells, ground pivots, UV playback, resource disposal, production isolation and declared package exports. Synthetic raster fixtures are unit-test inputs, not visual evidence.

Routine Fast DEV uses exact-source syntax/consistency checks. Browser/art fidelity is a separate visual observation and must not be inferred from source validation.

## Detachable authoring support

Capability gap: a reference image previously had no short path into an opt-in in-game 2.5D preview. Dependencies are browser raster decoding/canvas, the existing Three renderer and review route. Once approved materialized sprites are selected through the normal character registry, the temporary guest bridge and local draft tooling can be removed without replacing the portable metadata or shared sprite renderer.


## Character25D hybrid equipment runtime

`@soul/assets/character25d/three` is the deforming Actor adapter. The legacy `/sprite25d/three` atlas renderer remains compatible. `appearance.version=1` adds transparent front/side/back/quarter references while preserving original source hashes, provenance, draft status and the existing verification boundary. Auto-preparation removes border-connected background and derives candidate views from one source image. It does not synthesize missing rear art or grant authored eight-direction coverage. Quarter and opposite-side presentation are approximations and the status identifies that fact.

The Actor has an invisible bone hierarchy and a capsule descriptor. A skinned cutout writes local depth; the same torso/arm/palm pose carries its 3D equipment. Camera-relative facing selects the source view and changes near/far arm depth, while back views swap anatomical side ownership. World depth testing remains enabled. This is a socket-depth presentation, not a fixed render-order overlay or a weapon drawn into a texture.

Both RINNE's existing 3D protagonist and the Lab call `createRinneWeapon` from `@soul/assets/equipment/three`. This moves the existing sword/axe/spear/greatsword/staff/dagger geometry into a shared factory without creating Character25D-specific copies. The shield uses that factory too. Equipment IDs remain those from `life.equipment`.

| Requested metadata | Canonical field / derivation |
| --- | --- |
| gripOffset | `grip`, geometry-space pivot from existing weaponCalibration vocabulary |
| gripRotation | `rotation`, quaternion |
| gripScale | `scale` |
| offhandGripOffset | `supportGrip` |
| offhandGripRotation | `supportRotation`, relative to the primary weapon frame |
| twoHanded | `twoHanded`; suppresses separate shield |
| occlusionMode | `socket-depth` |
| defaultCarryPose | `side`, `guard`, or `two-hand` |
| attackTrailOrigin | `bladeTip` |
| hitboxOrigin | `bladeBase` |
| presentationCategory | blade / axe / polearm / staff / shield |

The profiles are structurally validated by existing `weaponCalibration`; parallel offset definitions are avoided. `rightHand -> weapon -> gripFrame` owns `secondaryGripTarget`, `weaponHitboxAnchor`, and `trailOrigin`. `leftHand` is also `offhand` and owns `heldItemAnchor`. `setHeldItem` accepts a host-owned 3D prop and the same grip/rotation/scale vocabulary; detaching returns the object without disposing shared resources. Hitbox/trail anchors are exposed for consumers and do not introduce new combat authority. Fixed-length two-bone solves keep the offhand on the secondary grip. Body recoil, attack and locomotion apply before socket world matrices are read.

Playground accepts real keyboard/touch movement, Idle / Walk / Run / Turn / Attack / Hit / Rest, five shared weapon choices, shield toggle, four camera views and weapon swaps during motion. Choice grids keep five columns on phones. RINNE transfer retains its one-time opener token, DEV/local opt-in, isolated verification and no debug panel or save mutation.

### Explicit specialist evidence

`tests/character25d-equipment.test.mjs` checks calibration compatibility, attachment ownership, finite transforms, main-hand drift and two-hand contact over a movement/action/view/weapon sequence. This is structural evidence, not visual approval.

`node scripts/browser/character25d-equipment.mjs` uses the repository's existing Playwright/SwiftShader stack to upload the repository Shino reference sheet through the real UI, record movement, camera changes, weapon swaps and a token transfer into the actual RINNE renderer. It records exact source SHA, images, trace, video, socket measurements and console errors. It is an explicitly invoked specialist path, not a new routine Fast DEV gate. A task-scoped observation workflow is temporary and is removed before final focused validation.

Single-image segmentation and joint placement are heuristic. Unseen views, intricate overlapping sleeves/hair, or anatomy outside the template require further image-generation/segmentation capability. Do not report general one-image vertical-slice success or human art approval solely from structural tests or a single passing character sheet.
