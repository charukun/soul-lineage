# Character Asset Sourcing

## Purpose

When a task adds or replaces a character model, do not default to generating a new mesh. Search reviewed repository assets and high-quality free asset catalogs first, then import the original eligible asset and preserve its real mesh data through the production pipeline.

This document defines the acquisition order. It does not relax `CHARACTER_LICENSE_POLICY.md`, the Character Production stages, visual approval, deformation QA, motion QA or runtime budgets.

## Default acquisition order

Use this order for new game-facing character geometry:

1. Reuse an already reviewed RINNE-owned asset or the current approved foundation when it fits the role.
2. Search the approved discovery catalogs below for a visually suitable candidate.
3. Apply the repository license/provenance gate before downloading or adopting the candidate.
4. Import the original asset into the DCC/runtime path and verify that mesh, materials, rig, morphs and animations survived the import.
5. Repair or adapt the imported asset in Blender only where needed for RINNE style, topology, rig, clothing, sockets or performance.
6. Only when no eligible existing asset can satisfy the role, create a new RINNE-authored asset or use a generative 3D service as a fallback input to the normal DCC pipeline.

A generation service is a fallback, not the first search step.

## Discovery catalogs

Search these sources before using a generative character service:

| Source | Intended use | Repository rule |
| --- | --- | --- |
| Fab | character/model discovery | Candidate only. Adopt only when the specific asset satisfies `CHARACTER_LICENSE_POLICY.md` and provenance can be pinned. |
| Blendkit | Blender-ready model discovery | Candidate only. The listing/source license does not override the repository license gate. |
| Sketchfab | broad character/model discovery | Prefer listings with explicit downloadable source and auditable license metadata. Adopt only when the exact asset is eligible. |
| Quaternius | stylized/game-ready model discovery | Useful as a visual/source catalog, but each candidate must still pass the repository license policy. |
| CGTrader | game-ready model discovery | Free price is not license approval. Pin the exact asset page, author, license and source hash before adoption. |

Supporting sources from the wider art workflow have narrower roles:

- Poly Haven is primarily for environment/material/HDRI support, not the default source for character bodies.
- Mixamo is primarily a rig/motion support route. Do not treat a Mixamo character as approved shipping geometry unless the exact asset independently satisfies the character license policy.

Catalog membership never makes an asset production-safe by itself. Many catalog entries will be rejected by the current CC0/RINNE-owned character policy.

## License and provenance gate

`docs/characters/CHARACTER_LICENSE_POLICY.md` is authoritative. At the time of writing, active game-facing character geometry is limited to RINNE-authored originals or eligible CC0-1.0 third-party assets with pinned provenance.

Before an external candidate can become `PRIMARY` or later, retain enough information to reproduce the source decision:

- provider/catalog name;
- exact asset page or canonical source URL;
- asset title and author/publisher;
- retrieval date;
- exact license identifier/text or repository-approved license evidence;
- original downloaded filename and format;
- SHA-256 of the downloaded source;
- required attribution/notices, even when the current policy later rejects the asset;
- conversion/edit chain from original download to repository runtime asset.

If the license is ambiguous, missing, conditional in a way the repository policy rejects, or cannot be pinned, reject the asset as a shipping candidate. It may remain a visual reference if its terms allow that use, but it must not silently enter the runtime catalog.

## Import invariant: preserve the real asset

When the selected source provides GLB/glTF/FBX/BLEND or another real mesh, the implementation must import that source asset. Do not "reproduce" it by replacing the body with `BoxGeometry`, `CylinderGeometry`, spheres, capsules or other hand-built/runtime primitives.

For an imported model, verify as applicable:

- mesh/primitive and triangle counts are plausible relative to the source;
- material slots and textures are present;
- armature/skeleton and skinning survive;
- morph targets / shape keys survive;
- embedded or separate animation clips survive;
- front, side, back and three-quarter silhouettes match the source;
- deliberate optimization steps are recorded rather than silently changing the asset.

If the only available implementation is a primitive/procedural substitute, classify it as `BLOCKOUT`. It is never evidence that an imported/high-quality character has been reproduced.

## Candidate selection

Prefer candidates that reduce downstream repair cost:

- style and silhouette already fit the target character direction;
- topology is suitable for deformation;
- rig is readable or the mesh is practical to re-rig;
- skin, hair, clothing and accessories can be separated or edited cleanly;
- materials/textures are present and understandable;
- source format is editable and exportable to the repository runtime format;
- triangle count, material count and texture footprint have a realistic path to the Pixel Fold-class budget;
- provenance and license are simple enough to audit and retain.

Do not choose a visibly worse candidate merely because it is easier to download.

## Generator fallback

Meshy, Tripo and similar generative 3D services are fallback sources when the catalog search finds no eligible model that can be adapted without excessive rework.

A generated asset must enter the same DCC/import, provenance, deformation, motion, polish and runtime gates as any other model. Generation success does not bypass Character Production stages.

When an eligible external asset exists, do not regenerate an approximate lookalike merely to avoid importing it.

## Worker procedure

For a character-addition task, the implementation worker should perform this sequence before creating new geometry:

1. inspect the current character catalog and reviewed source assets;
2. define the role, style and technical constraints of the requested character;
3. search the discovery catalogs above using those constraints;
4. discard candidates that fail license/provenance or obvious runtime/style requirements;
5. retain the best eligible source asset and import it unchanged first;
6. run fixed-view and structural checks on the imported source;
7. only then perform DCC adaptation and continue through `CHARACTER_PRODUCTION_PIPELINE.md`.

If direct catalog access or download is unavailable in the current execution route, record the blocked source step and switch to another authorized route. Do not silently replace the acquisition step with procedural geometry or an AI-generated substitute.

## Recurrence prevention

A future character task that starts by generating a new model without first checking the reviewed repository assets and the discovery catalogs above is out of process unless the task explicitly requires an original generated design.

A future task that claims to have reproduced an external GLB while replacing it with runtime primitives is also out of process. The production pipeline must preserve the distinction between imported real geometry and `BLOCKOUT` geometry.
