# Shino Reference v2 DCC rebuild

## Scope

Rebuild `shino.reference.v2` as a dedicated DCC-authored character instead of a runtime procedural blockout. The reference sheet at `docs/characters/references/shino/shino-character-reference-sheet-v2.png` is the visual source of truth for proportions, short light-brown bob hair, face, green capelet/tunic, blouse, shorts, belt, boots, satchel and overall stylized silhouette.

This work depends on Character Production Pipeline v2 (#192). It must not bypass that pipeline by relabelling runtime primitives as production geometry.

## Delivery target

- create a Blender source and exported GLB using the audited common humanoid skeleton contract
- keep skin, hair and clothing as separately reviewable surfaces
- render front / side / back / three-quarter review evidence from Blender
- generate an objective Blender audit report for mesh, armature, UV, materials, shape keys and triangle counts
- expose the DCC model in Character Workshop and Visual Review Lab as the Shino Reference v2 model
- keep `productionReady=false` until deformation, motion, polish, runtime performance and explicit visual approval gates pass

## Modeling intent

Primary forms prioritize silhouette, head/body proportion, face volume, hair mass and garment planes before fine decoration. Secondary forms add hair locks, capelet/hem thickness, belt/satchel, boot shapes and other defining details. Motion review follows relaxed idle, combat idle, transition, walk/run, attack, reactions, draw/sheathe and multi-view readability rather than front-view-only approval.

main / Production remain unchanged.
