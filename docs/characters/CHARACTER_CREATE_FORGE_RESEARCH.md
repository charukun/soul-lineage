# img2threejs code investigation

Inspected upstream `img2threejs/img2threejs` at
`6e60b5e22419464b4853e01ddb6c0e6f6659a733` before implementation.
License: Apache-2.0 (`LICENSE`). No upstream code/assets are copied, vendored,
executed or distributed by this implementation. The following concepts inform
an independent RINNE implementation; upstream license conditions would apply to
any future code transplant and must be recorded separately.

| Area | Source inspected | Concrete finding / decision |
| --- | --- | --- |
| Intake/landmarks | `forge/stage1_intake/extract_landmarks.py` | Its guide grid scaffolds anatomy for agent vision; generic guide positions are not detected landmarks. Keep inferred semantics separate from observed pixels. |
| Measurement | `forge/stage2_spec/humanoid_proportions.py` | Canon-table proportions have explicit provenance and are refused as reference measurements. RINNE uses image silhouette samples and labels joint priors inferred. |
| Likeness | `grimoire/character/likeness_maximization.md` | Fit/projection/camera matching and uncertainty reporting are useful concepts; no guarantee of likeness. |
| Geometry | `forge/stage3_build/generate_threejs_factory.py` | Spec-driven emission, quality failures and separate build passes; importing this large generator would bring a second schema/control plane. |
| Multi-view | `forge/stage3_build/visual_hull.py` | Real silhouette carving exists, but visual hull cannot recover hidden concavities. We use bounded component lofts that accept front/back widths and side depth. |
| Projection | `forge/stage3_build/bake_projected_texture.py` | This file emits a descriptor and explicitly does not bake pixels. RINNE implements sampling/blending/UV atlas baking itself. |
| Rig | `forge/stage5_rig/rig_spec.py` | Explicit parents, tips and ambiguity rejection; keep a single original humanoid rig with real bind/skin data. |
| Animation | `forge/stage5_rig/emit_animation_runtime.py` | Consumes clips, emits mixer runtime and requires changing sampled bindings; a clip name alone is insufficient. |
| Review | `forge/stage4_review/mesh_reference_compare.py` | Ground anchor, percentile widths and centroids distinguish alignment from shape; RINNE compares fixed-coordinate projected exported triangles. |
| State | `forge/_shared/workflow_state.py` | Ordered evidence-backed resumable steps; RINNE persists a 15-stage receipt and reconstructible spec, not chat memory. |
| Plugins | `forge/_shared/domains/__init__.py` | Domain discovery validates declarations and rejects duplicate ids; avoid introducing its plugin ecosystem into RINNE. |
| Provenance/license | `LICENSE`, anatomy and projection metadata | Pin inspected revision; preserve original hashes, inferred regions and source rights. No downloaded art fixture. |

Selected architecture: independent RINNE candidate reconstruction using concepts,
not package/CLI dependency or copied algorithms. Existing Character25D, equipment,
Camera Subject, Review UI and Character Production authority stay intact.
