# Character Modeling Standard

This standard applies to character mesh authoring and substantial appearance changes, including face, hair, body, clothing, accessories and Blender/GLB/VRM assembly. The goal is repeatable art quality without breaking the audited model/runtime contract.

## 1. Start from the correct source of truth

Before editing:

1. Read the applicable `docs/characters/*` contract and identify the canonical asset, rig, provenance, license and runtime constraints.
2. Identify which reference is authoritative for identity: approved character sheet, current accepted model, or explicit task reference.
3. Separate identity references from quality references. A quality reference may guide topology cleanliness, material response or hair construction; it must not silently replace the character's face, proportions or costume.
4. Mark reference gaps. Do not invent unseen back surfaces or accessories and then describe them as reference-accurate.

For existing characters, improving the approved asset is the default. Regeneration from scratch requires a concrete reason such as unusable topology, missing required surfaces, incompatible license, or an explicit replacement decision.

### Reference readiness for image-driven work

When a task starts from one or more images, fix ambiguity before it reaches geometry. For a full-body source, prefer a neutral front-facing pose with the full silhouette visible, hands and feet readable, arms separated from the torso, and an uncluttered background. Verify that the neck, fingers, face, hair outline, clothing edges and major accessories are actually readable.

Keep one complete identity reference available throughout the work so proportion, costume, color and hairstyle are judged against the whole character rather than against isolated crops. If the source image hides an important surface, record that limitation or prepare an explicit supplemental reference instead of silently guessing.

## 2. Preflight the real asset and tool path

Inspect the actual working asset before making changes. Confirm object/mesh names, armature, materials, textures, expressions/morphs, coordinate system, scale, animation clips and expected export/runtime path.

When using Blender or another DCC through automation, perform a read-only identification step first. Confirm the intended scene and target objects before destructive edits. If one automation path is unavailable, try another allowed path. Do not interpret "MCP not connected" as proof that no Blender workflow exists.

Do not replace the requested asset with spheres, cylinders, boxes, flat sprites or a newly generated unrelated model merely because the preferred DCC connection failed. Primitive blockout is allowed only as a temporary proportion study and must not be presented as production completion.

## 3. Build from large forms to local detail

Use this review order unless the task is explicitly narrower:

1. silhouette and body proportion;
2. head/face identity;
3. hair mass and flow;
4. clothing silhouette, thickness and intersections;
5. accessories and secondary forms;
6. material continuity and surface response;
7. rig deformation, expressions and animation behavior;
8. exported runtime asset.

Do not spend time on micro-detail while the silhouette or face identity is wrong. Do not use lighting, post-processing or texture noise to hide a geometry problem.

For new or heavily reconstructed assets, body/head/hair may be authored or generated as separate components when this improves control and review. The decomposition is optional. If used:

- keep the complete character reference visible for proportion and color decisions;
- prepare part-specific references deliberately instead of relying on a crop that leaves unwanted geometry or hides required joining surfaces;
- make the body reference readable through the outfit, limbs, hands and the neck area needed for assembly;
- make the head reference readable around face, mouth, eyes, jaw and neck, without hair obscuring surfaces needed for fitting when a separate hair asset is planned;
- keep hair together with any hat/accessory that structurally belongs to it, and preserve the approved outer silhouette;
- leave enough real geometry at seams for a clean join;
- name parts clearly and keep them separately selectable until alignment and seam review are approved;
- use the canonical body/current asset as the scale reference;
- review front, side and back after assembly, including neck seams and the back of the hair.

Close or refine local gaps and open surfaces before animation review. Preserve already-approved silhouette, UVs, materials and unrelated geometry while correcting local assembly defects.

## 4. Face and hair quality

A face change is judged by relationships, not by a generic "anime" preset. Compare outline, cheek-to-jaw transition, eye spacing/angle, eyelid shape, brow placement, nose/mouth projection and side profile against the identity reference. Do not solve every complaint by enlarging the eyes or narrowing the chin.

Hair should read first as intentional large masses and overlaps. Preserve the approved outer silhouette and attachment to the scalp, then refine secondary locks. Repeating equal spikes, disconnected strips, floating caps and uniform tubes are not acceptable substitutes for authored flow unless the approved style explicitly calls for them.

When the user only reports that the face or hair "looks wrong," the worker should compare the reference and current model, identify the few largest perceptual differences, fix those locally, and preserve already-approved regions.

## 5. Variants must become genuinely different people when that is the task

Color changes alone are colorways, not distinct character identities. When a task asks for a population that reads as different people, use reviewed combinations of silhouette/proportion, face structure, hairstyle, body build, garment shape and accessories while preserving shared gameplay/rig contracts.

Do not mutate gameplay collision, stats, authoritative genes, inventory or network data merely to make a visual variant. Follow the MasterCharacter/modular appearance contract for the boundary between presentation and game state.

## 6. Preserve working rig, UV and material data

Prefer reuse of a working armature and valid weights over creating a second competing skeleton. Preserve working UVs, materials, expressions, spring-bone/secondary-motion metadata, sockets and unrelated geometry unless the task specifically requires their replacement.

If a rigged replacement of an existing body is introduced, remove or clearly retire obsolete unrigged duplicates instead of leaving ambiguous competing bodies in the scene. Head, hair and other deforming character parts should bind or follow the intended shared character skeleton unless the model-specific contract explicitly requires another arrangement.

After geometry changes, test at minimum the deformations relevant to the edited region. Typical humanoid probes are head turn, arm raise, elbow bend, knee bend and squat. For game characters, also test the existing task-relevant actions such as weapon stance, draw/sheathe, pickup, rest or attack.

When a deformation fails, isolate whether the cause is mesh shape, topology, weight painting, skeleton, animation, expression/morph or runtime conversion. Repair the smallest responsible layer instead of broadly rebuilding the character.

## 7. Expressions must visibly deform correctly

Named sliders or shape-key entries are not proof of a working face. If expressions are in scope, visually test neutral, partial blink, full blink and at least one mouth/smile state as applicable. Inspect eyelid edge, lashes/hair intersections, mouth interior and skin/material continuity in close-up.

Discrete expression variants and continuous facial deformation are different implementations. State which one actually exists. If continuous blinking or mouth motion is required, the geometry must support it; add or fit missing eyelid/mouth surfaces when needed instead of pretending that a named control is enough.

Do not claim continuous facial animation when the implementation only switches discrete variants, and do not claim supported expressions that the actual geometry cannot perform.

## 8. Materials are checked after geometry is credible

Preserve intentional shading and known texture semantics. Resolve uncertain texture roles before reconnecting maps. Audit the actual available base-color/albedo, roughness, metallic and normal maps (and any model-specific maps/extensions) and connect only confirmed data to the intended shader inputs. Do not invent a new texture-generation pass merely to avoid understanding the supplied material set.

Compare face/neck/body tone, clothing readability and hair response under the same neutral lighting before adding dramatic scene lighting. A lighting improvement may be a separate valid task, but it must not be used as evidence that mesh quality improved.

## 9. Start animation validation with a short readable action

Before expanding to a complex performance, validate the character with a short action that makes silhouette, hands, feet, clothing intersections, rig deformation and facial controls easy to read. A greeting, weight shift or simple loop is usually a better first diagnostic than a long choreography.

If importing an existing motion, verify both usage rights and compatibility with the target rig/format before adopting it. If authoring a new action, preserve unrelated existing actions. Review at least the beginning, middle and end of the motion and record frame/time-specific defects such as hand-through-clothing, foot sliding or joint collapse so the same moment can be rechecked after repair.

## 10. Runtime and license are part of the model

Keep source provenance, license metadata/notices and reviewed hashes required by the applicable asset contract. New generated or third-party components need a traceable source and usage terms before adoption.

Validate the exported asset in the actual repository runtime path. DCC appearance alone is not sufficient. Preserve required GLB/VRM extensions and renderer expectations; do not claim unsupported shader/expression/spring-bone behavior.

Performance claims require measurement on the stated environment. Browser emulation and software rendering are not physical-device acceptance. Follow the model-specific budget and device gate where one exists.

## 11. Completion criteria

A modeling task is complete only when the requested scope has:

- the correct canonical/editable source retained;
- source/reference ambiguity resolved or explicitly recorded;
- identity and silhouette compared against the authoritative reference;
- local geometry problems corrected rather than hidden;
- required rig/expression/animation probes checked;
- exported runtime asset loaded successfully when export/runtime is in scope;
- provenance/license requirements preserved;
- visual evidence produced according to `VISUAL_REVIEW.md`;
- remaining unverified areas stated explicitly.

Code completion, successful export, a passing unit test, a screenshot, or a self-assigned quality score alone cannot satisfy the visual modeling gate.
