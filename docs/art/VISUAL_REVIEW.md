# 3D Visual Review Standard

This standard defines evidence for appearance-sensitive 3D changes. It complements automated tests. It does not turn Visual Review Lab into a mandatory Integration blocker; `docs/DEVELOPMENT.md` remains authoritative for the Lab's independent review role.

## 1. Compare like with like

Before/after and model/reference comparisons should use the same camera angle, framing/character scale, pose, projection, neutral lighting and background unless the task is specifically about one of those variables. If a condition changes, label it.

Do not present a stronger light rig, post-processing pass, different FOV or flattering pose as evidence that modeling improved.

## 2. Minimum view set

For full-character modeling or major appearance changes, review:

- front;
- three-quarter front;
- side/profile;
- back;
- face close-up when face/hair changed;
- one or more task-relevant deformation poses.

Narrow local changes may use a smaller view set when it fully exposes the edited region. New or uncertain joins should be inspected from both sides of the seam.

## 3. Review order

Review in this order so cosmetic polish does not mask structural defects:

1. silhouette and proportion;
2. face/identity;
3. hair and clothing intersections;
4. material continuity under neutral lighting;
5. rig deformation and expressions;
6. task-relevant animation;
7. actual exported/runtime appearance;
8. performance evidence when performance is part of the claim.

Record the important remaining defects rather than forcing an artificial all-green result.

## 4. Runtime evidence must use the delivered asset

When the game consumes GLB/VRM or another exported representation, the final runtime visual review must load that delivered representation, not only the Blender scene or a generated illustration. A rendered concept image can guide art direction but is not runtime-model evidence.

Report which file/revision was reviewed. For material/animation/export-sensitive work, state which behaviors were verified in DCC and which were verified in runtime.

## 5. Character Studio and Visual Review Lab

Character Studio (`apps/rinne/characters.html`, as documented in `docs/characters/CHARACTER_STUDIO.md`) is the production inspection surface for MasterCharacter identities, modular parts, deterministic comparison and workspace continuity. Use it when the task affects that pipeline.

Visual Review Lab is a separate fast human-review lane with its own long-lived branch/preview contract. Use it when a reviewable visual preview materially helps the task, but do not rewrite normal implementation/Integration flow around it and do not treat Lab publication itself as proof of visual acceptance.

A good review surface should make the real asset easy to inspect rather than decorate it: stable viewport, predictable camera controls, explicit selected actor/variant, deterministic comparison, clear pose/expression controls and no hidden randomization of the subject under review.

## 6. Deformation and animation probes

Repeat the exact pose/action after a local rig/weight correction. For frame-specific animation defects, record action/clip and frame or time, then verify the same point after repair. Preserve unrelated actions.

For a newly introduced or substantially changed action, inspect at least the beginning, middle and end before judging the whole performance. Prefer a short readable diagnostic action first; it should expose silhouette, planted/stepping feet, hands, clothing intersections and the edited rig/facial controls clearly enough to diagnose defects.

Typical checks include shoulder under arm raise, elbow/knee bend, neck turn, crouch/squat, hand-to-weapon/socket relationship, clothing/limb intersections and task-specific actions such as draw/sheathe.

## 7. Evidence and claims

A completion report should distinguish:

- appearance comparison completed;
- DCC deformation/expression checks completed;
- exported asset load/runtime check completed;
- automated tests completed;
- device/performance measurement completed;
- human art approval, if actually given.

Do not upgrade one category into another. In particular:

- passing tests do not prove visual quality;
- successful export does not prove correct deformation;
- HTTP 200 does not prove the rendered model is correct;
- software WebGL/browser emulation does not prove Pixel Fold-class performance;
- a worker's self-rating does not equal human art approval.

When performance is measured, record the model/build revision and enough environment detail to make the result meaningful. Follow any stricter model-specific acceptance contract.

## 8. Review feedback format

When possible, convert feedback into four pieces:

- **target**: exact part or action;
- **observed**: what differs or fails;
- **expected**: what the reference/contract requires;
- **preserve**: approved regions/contracts that must not change.

If the reviewer cannot explain the cause, the worker should perform the visual comparison and propose the smallest likely corrections rather than asking the reviewer to diagnose topology or weights.
