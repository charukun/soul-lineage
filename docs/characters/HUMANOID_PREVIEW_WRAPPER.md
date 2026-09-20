# Humanoid preview wrapper v1: review, plan and acceptance

Baseline: develop `1dc49eaa47f9b7c9eca9fa3166e0db46ed891ac6`.
Scope: shared rendering adapter and RINNE motion review. Not a replacement of gameplay animation, a character adoption gate, or a Production promotion.

## Design review

The adopted goal is to combine eligible imported character models and motion sources for exploration even when the result is anatomically imperfect. A useful approximate preview must not be confused with a verified deformation or production-ready asset.

| Finding | Decision implemented in v1 |
| --- | --- |
| A mesh, a skeleton, a weighted/skinned model and an animation are different capabilities. A filename or `reviewModel:true` does not prove them. | Inspect actual joints and skin attributes. Sources may be skeleton-only. Unweighted targets retain a static preview with `RIG_REQUIRED`; no fake skin or fabricated motion. Reference models are rejected as motion sources. |
| Several semantic slots pointing to one real bone overwrite each other. | Each physical joint has at most one slot. Compose missing serial torso deltas into the nearest existing torso ancestor. Do not map a missing head to the chest, a hand to an elbow, or invent missing fingers. |
| Separate wrappers for every head/body ratio create another model-specific maintenance problem. | One adapter plus measured rest-skeleton height, leg length, arm length and shoulder width. Ratio labels are descriptive, not age/species/appearance inference. Geometry and limb lengths remain target-owned. |
| Name guessing alone missed the real error. | Explicit stable hierarchy paths, then normalized known names, then bounded upright-biped hierarchy/position inference. Inferred assignments are always `DEGRADED`. Ambiguous named matches and disconnected chains are reported rather than silently chosen. |
| Rest-pose, axes, units, helper joints and root displacement are separate concerns. | Bind once on the fresh/rest scene, retain a canonical basis quaternion and reset before clip sampling. Include intervening animated helper rotations. Convert hip displacement through the parent matrices and leg-ratio gain. Expose in-place/free/locked policies. |
| Auto-skipping incompatible clips can show a different movement than the selected thumbnail. | Preserve the selected source identity. Play partial mappings in preview mode; show an explicit error/retry for truly unusable data. Never silently replace the user's chosen motion. |
| Permissive preview must not become permissive asset ingestion. | Preserve pinned source byte/hash checks and the strict source API. Verify CC0 review targets and their exact bytes before parsing. No new external asset, third-party runtime URL, or retired model is adopted. |
| Old selection promises, repeated grid recreation and an undefined `resize()` could independently break the view. | Guard both successful and failed async completions by model/selection generation. Keep card nodes on selection. Use the existing stage lifecycle and keep RAF alive after a recoverable playback failure. Native/legacy clips remain operable. |
| Regex checks and successful builds did not prove a moving character. | Add native Three.js pose, vertex-deformation, seek/clip-switch, topology, integrity and scale tests. Additional geometry-only probing uses already-published immutable KayKit bytes. Do not call that browser or DEV verification. |

## Delivery plan executed in this change

1. **Binding and capability layer**: `packages/rendering/src/humanoid-binding.js` resolves joints, records methods/stable paths, inspects skin data and measures ratios. It never mutates source geometry or grants asset approval.
2. **Pose adapter**: `packages/rendering/src/humanoid-preview.js` owns immutable rest transforms, canonical preview poses, partial-body application, torso composition, root-motion policy and bounded displacement. `strict` refuses approximate application; `preview` allows it with diagnostics.
3. **Source and review integration**: keep the original strict normalization API for existing consumers. Opt the motion view into `preview:true`; use the same common wrapper for target and thumbnail poses. Skeleton-only motion sources are valid, models need not contain embedded clips, and the UI shows the selected binding/result under `互換性・体格`.
4. **Verification and delivery**: run the wrapper/source/UI focused tests and RINNE build on the exact work head in the existing hosted validator, reconcile current develop, validate the reconciled head and merge. No persistent workflow/lifecycle expansion; DEV publication stays asynchronous.

## Status contract

- `PLAYABLE`: structurally resolved and accepted for preview. It is **not** a visual-quality, contact, anatomical or performance approval.
- `DEGRADED`: partial or inferred binding, missing source channels, composed torso channels, or bounded root displacement. Preview continues; reasons remain available. Strict mode does not apply this result.
- `RIG_REQUIRED`: no usable skinned target, or too little mapped anatomy for a meaningful transfer. A static mesh can still be viewed. A rig plus weights must be authored/materialized before articulated deformation is possible.
- `UNSUPPORTED`: invalid transforms, corrupt skin data, invalid pose/options or a load/integrity error. Do not disguise this as merely imperfect movement.

The serialized descriptor contains adapter version, source hash, mapping paths, mapping method, canonical basis, measured profile and `productionApproved:false`. Its cache identity includes all calibration inputs, not merely model name. Live bone references are per-scene, never shared across cloned targets. No persistent cache or new asset database is introduced.

## Boundaries and follow-on plan

The v1 transfer is **rest-relative**, not a guarantee of perfect T-pose/A-pose or skeleton-axis calibration. Exact/manual mappings can be supplied through `mapping` and coordinate calibration through `basis`. Geometry inference assumes a roughly upright biped in that basis, uses at most 128 candidate joints, and must not be advertised as arbitrary creature recognition.

No weight generation, quadruped/wing/tail transfer, hand-contact IK, foot locking, weapon constraints or shipping-character promotion is included. Those are distinct next stages:

1. Calibrate rest poses for a reviewed representative set of genuinely different eligible rig families and body proportions, not only the five KayKit appearances sharing Rig_Medium.
2. Add explicit contact/foot/weapon constraints to selected high-value clips, retaining raw preview for comparison.
3. Route `RIG_REQUIRED` assets through the existing DCC materialization workflow with an eligible rig and authored/automatic weights, validate the resulting GLB, then admit them as skinned targets. A plain mesh cannot be solved by adding more bone-name aliases.
4. Persist approved adapter descriptors against immutable asset hashes when the importer consumes them. Keep license, visual approval and Production gates independent.

Unknown models are not automatically added to the active catalog. Registration/provenance is still needed; adding an eligible model with a supported or inferred skeleton does not require a new model-specific motion player.

## Evidence interpretation

`tests/humanoid-preview-wrapper.test.mjs` proves actual vertex deformation on weighted fixtures, several proportions and naming/hierarchy cases, partial torso composition, reset isolation, scale/orientation behavior, and rejection of corrupt input.

`tests/humanoid-preview-source.test.mjs` proves partial-source sampling, exact-end/backward seeking, clip isolation and that preview does not bypass clip/source/target integrity. `tests/review-effects-motion-thumbnails.test.mjs` retains the existing layout/accessibility guards and replaces the obsolete automatic-substitution policy with selected-clip preservation and stale-request/RAF guards.

Browser evidence must be described separately. A downloaded artifact, native geometry probe, static source review or a successful RINNE build is not `DEV browser verified`. Merely adding `Browser-Playtest: rinne` to a PR is not proof that a browser workflow actually ran.

## External technique references

- Three.js SkeletonUtils: https://threejs.org/docs/pages/module-SkeletonUtils.html (named retargeting options; clone shares geometry/materials).
- glTF 2.0 skinning specification: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins (joints, inverse bind matrices, skin attributes).
- Blender Armature Deform parenting: https://docs.blender.org/manual/en/latest/animation/armatures/skinning/parenting.html (automatic weights can require correction).

These explain techniques; repository asset/license/runtime contracts remain authoritative.
