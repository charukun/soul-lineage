# Shino Reference v2 DCC rebuild

## Scope

Rebuild `shino.reference.v2` as a dedicated DCC-authored character instead of a runtime procedural blockout. The reference sheet at `docs/characters/references/shino/shino-character-reference-sheet-v2.png` is the visual source of truth for proportions, short light-brown bob hair, face, green capelet/tunic, blouse, shorts, belt, boots, satchel and overall stylized silhouette.

This work depends on Character Production Pipeline v2 (#192) and the DCC PRIMARY implementation (#197). It must not bypass that pipeline by relabelling runtime primitives or unreviewed animation evidence as production geometry.

## Delivery target

- preserve the audited Blender source and exact-hash VRM from the PRIMARY pass
- complete SECONDARY review for hair forms, garment volume and accessories
- bind authored visible surfaces to the audited humanoid armature and pass neutral / head-turn / arm-raise / elbow-bend / knee-bend / crouch deformation review
- provide relaxed idle / combat idle / relaxed-to-combat / walk / run / attack / hit-small / hit-large / weapon-draw / weapon-sheathe motion evidence at normal playback speed
- record center of gravity, silhouette, line of action, anticipation, timing/spacing, gameplay exaggeration and camera-versatility evidence
- add neutral / blink / smile / mouth-open facial evidence, material polish and controlled secondary motion
- expose the final exact-hash DCC model in Character Workshop and Visual Review Lab without procedural overlays
- verify final runtime WebGL2 loading, integrity, eight-direction readability and explicit visual approval
- record desktop and Pixel Fold-class runtime budgets before setting `productionReady=true`

## RUNTIME_READY acceptance

`RUNTIME_READY` is allowed only when the production manifest contains evidence for every prior stage and the repository production gate passes without exceptions. Runtime evidence must include exact asset hash/provenance, WebGL2, triangle/draw-call/texture budgets, desktop p95 <= 16.67 ms, Pixel Fold-class mobile p95 <= 33.34 ms, eight-direction final review and `visualApproval=approved`.

If a real Pixel Fold hardware run is unavailable in the implementation environment, do not fabricate it. Use the repository's approved Pixel Fold-class browser/runtime profile only when the production contract explicitly accepts that evidence, otherwise leave `productionReady=false` and document the remaining hardware gate.

## Modeling intent

Primary forms prioritize silhouette, head/body proportion, face volume, hair mass and garment planes before fine decoration. Secondary forms add hair locks, capelet/hem thickness, belt/satchel, boot shapes and other defining details. Deformation must preserve those forms under the audited rig rather than simply attaching static meshes. Motion review follows relaxed idle, combat idle, transition, walk/run, attack, reactions, draw/sheathe and multi-view readability rather than front-view-only approval.

The final result must read as the reference-sheet Shino at front / side / back / three-quarter and under motion. Numeric tests, a successful Blender export, or a single front render are not visual approval by themselves.

main / Production remain unchanged.
