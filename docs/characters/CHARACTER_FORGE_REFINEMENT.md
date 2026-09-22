# Forge Quality Refinement Loop

This is the Character Create Forge authoring contract, subordinate to current
`AGENTS.md`, `docs/art/CHARACTER_MODELING.md`, `docs/art/VISUAL_REVIEW.md`, and
`CHARACTER_CREATE_FORGE.md`. It extends the existing package pipeline and does
not introduce a second asset registry or a production-approval route.

## Reference and discovery contract

Motion Review enumerates its pinned canonical source/clip records through
`apps/rinne/src/review/motion/registry.js` and resolves real assets through its
source runtime. Forge uses the same data-first principle: discover validated
`packages/assets/characters/forge/*/manifest.json`, generate the shared asset
registry, select by package id, and load the hash-verified delivered GLB.
Do not put GLB paths or a separate hand-maintained list in Review UI.

The main turnaround is the identity/proportion source. Rig / Morph / Sockets /
UV diagrams are implementation guidance, not alternate silhouettes. A quality
reference guides construction/finish, never silently changes identity. Keep the
full source available in the model-first Lab viewport; the comparison pane and
technical details remain secondary within the shared Review Lab frame.

## Repeatable loop

1. Generate an unapproved package. Structural validation only permits candidate
   registration. Initialize `review/refinement.json` as `awaiting-capture`.
2. Inspect the actual GLB in Blender, retain its editable `.blend`, and capture
   front / side / back / three-quarter with fixed camera, pose, neutral lighting,
   scale and ground. Bind captures to model SHA-256 and exact source checkout.
3. Compare identity references and explicit existing quality references. Record
   `target`, `observed`, `expected`, `preserve`, relevant views and finding ids.
4. Repair only failing regions in the actual DCC mesh. Preserve working rig,
   weights, UV, materials, expressions, sockets and animation streams. Re-export.
5. Validate the new delivered GLB, recapture all four views under the same recipe,
   compare again, and recheck the same findings and action phases.
6. Stop after at most three repair rounds. Remaining failures or unknowns remain
   visible. Worker review can reach `ready-for-human-review`, never `approved`,
   `productionReady=true`, or Character Production promotion.

The existing Heroine Dawn QA is the concrete precedent:
`docs/characters/qa/heroine-dawn-v1/README.md` records first-round holes/hard hair,
second-round Walking_A 28% garment protrusion, and a local 128-vertex repair
rechecked at the same phase. It also separates source hashes, DCC renders, real
Character Studio captures, preserved rig/clip bytes, and human approval. Reuse
that method, not that character's proportions.

## Side reconstruction

The spec keeps independent `frontZ`, `backZ`, `centerOffset`, `frontDepth`, and
`backDepth` per section. The interior anatomical axis is inferred; silhouette
endpoints are sampled/interpolated evidence. Regional front/back curvature is
independently controlled for cranium, thorax, abdomen, pelvis, glute, neck, arms,
hands, legs and feet. A uniform symmetric ellipse is not the generator contract.

Forehead, eye plane, cheek, nose, mouth plane, jaw and chin become actual head
rings. Face and occiput endpoints remain independent. The same asymmetric
surface drives geometry, normals and texture projection; no nose-only mesh
change can diverge from the baking surface.

Occluded arm/leg thickness and hidden curvature cannot be uniquely recovered
from a single side silhouette. Their priors remain explicitly inferred. Current
intake expects an image-left-facing side reference. Invalid orientation/profile
parameters fail closed rather than silently reversing source projection.

Fixed Side diagnostics report front endpoint error, rear endpoint error, total
depth error and silhouette-midpoint error in fractions of full body height.
No per-view recentering/auto-fit is allowed to hide a shifted profile. These are
diagnostic measures, not perceptual approval or proof of clean facial topology.

## Scope and validation

The reusable implementation comprises `side_profiles.py`, the existing spec /
geometry / projection / validation pipeline, package-owned refinement state,
`refinement.py`, a real Blender correction/export adapter, shared registry fields,
and the existing dedicated Forge viewer. Focused tests must cover asymmetric
endpoints, all facial planes, distinct body profiles, missing/occluded evidence,
stale captures, unsupported approval, integrity, and candidate rediscovery.

Exercise the DCC loop on actual generated assets, including a second character
input, and use the repository's existing Forge browser evidence route to load
the delivered GLB. A synthetic fixture proves replayability, not Golden Base art
quality, Golden Rig compatibility, clean hand topology, or physical-device fps.

This is an explicit specialist route. Do not add DCC/browser installs or a new
mandatory sweep to routine Fast DEV. The final PR head still requires hosted
focused validation, current-develop reconciliation/freshness, and same-session
develop merge. DEV publication remains asynchronous; main/Production is out of
scope.
