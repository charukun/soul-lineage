# Character25D × RINNE equipment

The v2 Character Forge Actor supports a raster body and real 3D equipment in the
same scene. `runtime-equipment.js` is the existing RINNE procedural weapon and
shield geometry, extracted from the protagonist renderer. Both renderers call
that factory; there is no Character25D weapon asset catalog or copied model set.

`actor.setEquipment(life.equipment)` consumes the existing weapon IDs and shield
boolean. It does not modify inventory or grant combat authority. The opt-in DEV
companion reads the live state each frame, follows normal movement, and mirrors
the existing training-impact event. Its bootstrap is idempotent across legacy
and Forge entry paths; one Actor owns the live render callback. Normal entry and Production have no guest panel.

## Attachment and presentation

The invisible body's rightHand owns weapon → gripFrame. The calibrated 3D model,
secondaryGripTarget, weaponHitboxAnchor and trailOrigin share that frame.
leftHand/offhand owns shieldAnchor and heldItemAnchor. Compatibility handR/handL,
weapon and hitbox names remain available. Damage remains the host's responsibility.

The compiler measures separated palm silhouettes and places the existing hand
bone pivots on those original pixels; concealed hands keep the template fallback.
This prevents a numerically attached weapon sitting below the illustrated palm.
Fixed-length arm IK follows the primary and secondary grips. The appearance's
arm bones follow the same world targets, including local depth. Alpha-tested
body layers and depth-writing 3D models therefore change occlusion with camera,
facing and motion; there is no universal front/side/back render-order list.
Near arms/hands can cover the torso, while far arms/weapons are occluded by it.
A narrow profile arm region follows the visible hand; its binding swaps with
camera side without mirroring source pixels. A palm depth bias keeps fingers
over the grip surface, and gripping pixels are excluded from cloth lag.
Attack is retained during movement; hit/recovery and view transitions update
attachments in the same frame. No detached weapon image or trail duplicate is used.

## Metadata compatibility

| Requested concept | Existing canonical field / extension |
| --- | --- |
| gripOffset / gripRotation / gripScale | `grip`, quaternion `rotation`, `scale` |
| offhandGripOffset / offhandGripRotation | `supportGrip`, quaternion `supportRotation` |
| twoHanded | `twoHanded` |
| hitboxOrigin / attackTrailOrigin | `bladeBase`, `bladeTip` |
| occlusion | `occlusionMode` (default `socket-depth`) |
| carry / category | `defaultCarryPose`, `presentationCategory` |

The records accept the established `@soul/animations.weaponCalibration` schema.
Points are in weapon geometry space; scale retains the existing protagonist's
world dimensions, independent of the normalized drawing skeleton. Optional
per-asset overrides are the second argument to `setEquipment(state, profiles)`.
Shield is stowed for two-handed profiles. `setHeldItem(object, calibration)`
attaches a host-owned prop; replacement returns/detaches it without disposal.

The Playground offers sword, axe, spear, greatsword, staff, shield and swapping,
with its existing keyboard/touch movement and action transport. The single-actor
view removes comparison-model overlap during grip/occlusion review. Use one sheet
with front/side/back artwork for directional review. Source art still determines
hand quality: template rigging cannot invent fingers or unseen body surfaces.
The opposite side remains the Forge's explicit unmirrored fallback.

## Explicit specialist verification

`tests/character25d-equipment.test.mjs` checks real Three transforms, both grips,
appearance alignment, calibration, moving attacks and resource ownership.
`scripts/browser/character25d-equipment.mjs` records actual Playground input and
the existing Lab → RINNE transfer, equipment state and training attack, screenshots,
video and console errors. `tests/character25d-equipment-browser.test.mjs` runs
that scenario on the final hosted checkout. This is task-selected evidence, not an automatic CI
sweep. The existing opt-in snapshot is read-only and can be removed when visual
inspection no longer needs this observability bridge. Numeric attachment alone
does not certify art quality or complete visual-slice success.
