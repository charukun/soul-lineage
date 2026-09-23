# PR #1524 upstream Forge recovery

## Status

Incomplete; PR stays Draft. This is a recovery record, not a character acceptance
report. Do not mark Ready or merge this branch from the installation smoke result.

- PR: https://github.com/charukun/soul-lineage/pull/1524
- Branch: `work/character-forge-upstream-20260923`
- Recovery-start develop: `0a7eb58151a83214b505f8b8390006b5a509e40d`
- Recovery-start work head: `1afc2eb7f726201b0f16d44de1de70971a5641e5`
- Original last task run: https://github.com/charukun/soul-lineage/actions/runs/35794189103
- Installation repair: `bc3bfe49f2de6a29972aa70f753bd193cd16de09`
- Installation repair hosted result: https://github.com/charukun/soul-lineage/actions/runs/35804682954

## What actually stopped

The original three commits added five files. The last task run succeeded at
source/dependency materialization and archive publication. `specialist.mjs`
reported `notVisualValidation: true`; it did not invoke a character reconstruction.
All three ordinary Astra validation runs were skipped. No PR discussion supplied
a later model, blocked stage, or continuation. Repository evidence therefore
locates the stopping point; it cannot establish why the prior chat stopped.

Executing the existing workspace installer against the exact downloaded upstream
reproduced `KeyError: 'id'`. The pinned plugin manifest has `name: character`,
whereas its domain declaration has `id: animated-character`. Harness contract
section 6 requires the registry id to equal the manifest **name**. The repair uses
that name and the documented version/repo/ref/resolvedSha registry fields. No
upstream source, pin, algorithm or gate changed.

`verify_upstream.py` runs the real pinned `state.py init`, `state.py status`, and
`next.py`. It checks the animated-character steps, rejection of out-of-order rig
binding, and preservation of pending work on resume. This is installation/state
boundary evidence only.

## Unresolved required adapter target

The request requires existing **Golden Rig**, **Golden Morph**, and **Golden
Socket** contracts and forbids introducing a Forge-only replacement. No declared
mapping from those requested names to an active repository target was found in
the inspected contracts, packages, current tree paths, or model.

Known, distinct repository contracts:

| Path | Observed contract |
| --- | --- |
| `docs/characters/KAYKIT_FOUNDATION.md` | Active foundation is KayKit `Rig_Medium`; it does not identify itself as the requested Golden contract. |
| `apps/character-studio/tests/character-review-rig.test.mjs` | Character Workshop resolves the KayKit humanoid bone contract. |
| `packages/assets/characters/forge/golden-base-boy-v1/manifest.json` | Candidate uses `rinne.forge.humanoid.v1`, `visualApproval: pending`, `productionReady: false`. |
| `packages/assets/characters/forge/golden-base-boy-v1/build/character.glb` | 16 meshes, one skin, 20 joints, ten clips, **zero morph primitives and zero morph target names**. |
| `packages/assets/forge/sockets.py` | Existing Forge hand/equipment aliases; no declared Golden mapping. |
| `packages/characters/golden/README.md` | Golden **performance baselines** derived from approved RUNTIME_READY assets, not a rig or morph schema. No `.golden.json` baseline is present. |
| `docs/characters/MASTER_CHARACTER.md` | Historical Shino rig/expression contract; active reuse is retired by `CHARACTER_LICENSE_POLICY.md`. |

`audit_targets.py` records a tracked-text search, the actual GLB inventory and the
source SHA in `adapter-target-discovery.json` on the hosted task runner. A name
search cannot prove the meaning of an undocumented alias. Consequently none of
the above is silently relabelled as Golden.

**Resume condition:** identify the authoritative path/revision for each requested
Golden contract, including rig hierarchy/bind conventions, morph names/ranges/
semantics, and socket names/bones/transforms; or explicitly define the intended
mapping to the active existing contracts. Adding an adapter without that target
would fabricate compatibility. This is a contract dependency, not a failure of
Connector, Actions, Blender or image access.

## Pinned engine findings that the implementation must preserve

- img2threejs: `6e60b5e22419464b4853e01ddb6c0e6f6659a733`
- plugin-character: `d8750638f9fc092714e7fcb4941053514455295d`
- img2 harness: `7aa41b37ee24dde844390bb05eca76b709e91599`
- `extract_landmarks.py` emits guides/placeholders; its generic guide lines are
  not observed measurements. Character authoring must fill measured anatomy.
- `humanoid_proportions.py` is the reference-free canon route and refuses a
  reference-backed spec. Do not substitute it for landmark fitting.
- `solve_camera_pose.py` exposes a numerical correspondence fitter as a Python
  API; the simple CLI emits an initial camera guess, not a solved camera.
- `delight_albedo.py` performs actual pixel de-lighting.
- `bake_projected_texture.py` explicitly emits a **descriptor only**, not baked
  pixels. Implement and prove the runtime projection/bake described by upstream;
  do not claim the descriptor is an albedo texture.
- `visual_hull.py` actually intersects front/side/top silhouettes, up to a 32-cell
  grid. Back is not a third independent axis. The hull is an upper shape bound,
  not the final facial/character surface or evidence of unseen concavities.
- `mesh_reference_compare.py` compares two meshes using feet/height alignment,
  band widths/depths and centroid offsets. It does not turn a source image into
  an authoritative reference mesh.
- `orchestrate_passes.py`, `append_review.py`, `next.py`, the turntable,
  multi-angle and part-coverage gates retain authority. No automatic approval.
- plugin-character's freeze/bind/parity order remains mandatory. Its rig gate
  reports unmeasured checks as errors; some upstream producers are absent. Never
  manufacture passing inputs.

## Outstanding implementation and acceptance

All reconstruction/visual acceptance items remain open: reference-specific
anatomy, fitted cameras, visual-hull constraints, strict spec, staged factory,
actual projection/bake, per-pass renders/comparisons and bounded corrections;
Golden rig/morph/socket adapters and parity; final package/registry/Lab model;
DCC refinement if needed; regression fixture; focused build, actual Forge and
browser evidence on the reconciled final head; Ready, develop merge and DEV start.

The old `pipeline.py` loft route remains the current CLI default and has not been
deprecated in this recovery checkpoint. Character25D, current character runtime,
Camera Director, normal Fast DEV and Production gates are unchanged.

The branch-only specialist workflow is still needed for continuation. Remove it
before constructing the eventual mergeable final tree. Do not create a replacement
branch or PR. Keep all subsequent evidence bound to the actual current model/head.
