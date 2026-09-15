# Arcanist Atlas DCC comparison

## Purpose

Build one Blender-authored Arcanist model from `docs/characters/references/npc-role-set/arcanist.avif` without replacing the existing runtime reference model or the independently published `ARCANIST_ATLAS_STUDY` blockout in Visual Review Lab.

The comparison set is intentionally three-way:

1. `arcanist.reference.v1` — existing runtime reference baseline.
2. `arcanist.atlas-study.v1` — the current runtime-procedural Atlas comparison model; keep it visible and unchanged for review.
3. `arcanist.atlas-dcc.v1` — a separate Blender-authored candidate built on the audited humanoid rig.

## DCC scope

- Use the repository's existing headless Blender route and audited `SHINO_review.vrm` humanoid skeleton as the compatibility rig.
- Author dedicated skin, hair, clothing and accessory surfaces in Blender rather than promoting Three.js primitives.
- Preserve the Arcanist reference cues already recorded by the repository: refined scholar/magic silhouette, mantle, book, glasses, tied long hair, scroll/satchel vocabulary and staff/book review prop.
- Keep gameplay equipment ownership separate. Visible staff/book forms are review presentation and do not grant combat or inventory behavior.
- Save the editable `.blend`, exported GLB candidate, four fixed-view review renders, Blender audit and exact hashes.
- Pin the committed Arcanist reference SHA before Blender execution so the build cannot silently switch concept input.
- Do not claim `RUNTIME_READY`, visual approval, deformation approval or device performance from the DCC build alone.

## Review integration

The existing `ARCANIST_ATLAS_STUDY` must remain selectable. The DCC model receives its own distinct preset and must never silently replace either existing Arcanist entry.

Visual Review Lab remains the independent Draft review surface. The DCC work uses its own implementation branch and does not overwrite concurrent Lab work.

## Execution route

The branch includes a dedicated headless GitHub Actions Blender build. This is the same authorized execution class already proven by the Shino DCC pipeline, but the Arcanist source, outputs and concurrency group are isolated. The workflow generates and audits the real editable Blender source rather than promoting the runtime-procedural Atlas mesh.

## Baseline

Started from `develop` `f2ac3484c748ed5389d88a7e0e17d6b2f8f1ab4f`.

Depends-On: none
