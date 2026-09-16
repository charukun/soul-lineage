# Public Web Asset Library Phase 2

Task: materialize the next safe public-web asset batch for Rinne, MURAAAAAAA and 尽喰廻遊.

Starting develop: `44198654a7b2f4c5453a9ba7cdaaf8edf2976876`.
Depends-On: PR #483, which introduces the shared public-web catalog and phase-1 materialized assets.

This follow-up preserves provenance, license text and immutable hashes where available. Runtime code must not depend on mutable third-party URLs.

## Materialized selection

### Kenney Interface Sounds

Source mirror: `Calinou/kenney-interface-sounds@4596a49eaf5a533948d49a47467f606bcdea70ff`.
License: CC0-1.0.

Five compact UI cues are selected by semantic use rather than importing the full pack:

- confirm
- error
- select
- click
- toggle

Each file is fetched from the immutable commit and verified against its Git blob id before it can be committed.

### Kenney Impact Sounds

Original asset family: Kenney Impact Sounds.
Pinned source mirror: `Boyquotes/kenney-impact-sounds-for-godot@999dd1684873f8b020a3aa5b26e713da21688924`.
License: CC0-1.0; the pinned source also carries the CC0 1.0 legal text.

Selected cues:

- heavy metal hit
- medium punch/body hit
- heavy wood hit
- light generic impact
- grass footstep
- wood footstep

The catalog exposes these as semantic individual assets so apps do not need to know upstream filenames.

### Kenney Particle Pack

Pinned source mirror: `Calinou/kenney-particle-pack@ab7086639ee73be31abd87feb21bf1402d4e8144`.
License: CC0-1.0.

Selected textures:

- spark
- slash
- smoke
- flare
- magic

These complement the phase-1 simplex-noise shaders. Apps can combine the shared sprites with procedural noise instead of shipping a large VFX framework.

### Poly Haven Medieval Blocks 05

Canonical asset: `https://polyhaven.com/a/medieval_blocks_05`.
Author: Rob Tuytel / Poly Haven.
License: CC0-1.0.

A mobile-oriented 1K subset is materialized:

- diffuse
- OpenGL normal
- roughness

The provider is not Git-backed, so the phase-2 manifest records the canonical source URL, exact fetched URL and locally calculated SHA-256 for every imported map.

## Provenance and integrity

`assets/vendor/public-web/PHASE2_MANIFEST.json` is generated from the materialized files. Git-backed assets record repository, pinned commit, Git blob id, SHA-256 and license. Poly Haven files record canonical asset URL, fetched file URL, SHA-256 and license.

`packages/assets/tests/public-web-catalog.test.mjs` verifies:

- all sources explicitly allow redistribution and use the audited CC0/MIT license set;
- all three apps see the same shared catalog;
- every `MATERIALIZED` catalog item resolves to repository-local files;
- all phase-2 manifest SHA-256 values match the committed bytes;
- remote candidates never expose runtime URLs or pretend to be local assets.

## Runtime boundary

Materialization means the bytes are available in the repository and provenance is pinned. It does not imply automatic scene placement, visual approval, gameplay authority, Production publication, or that every app must ship every asset.

App-specific adoption remains a separate art-direction/runtime task. No main or Production change is part of this PR.
