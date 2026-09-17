# Character DCC Carrier

## Purpose

Character DCC Carrier is the repository-wide Blender execution path for character builds. Future sessions should not recreate a per-character workflow or a request manifest.

The authored input is deliberately tiny so modeling stays character-specific while Blender execution, source provenance, audit, hashing and generated-file handoff stay reusable.

## Two-file contract

Start from current `develop` on a short-lived branch named exactly:

```text
dcc/<slug>
```

The character directory is:

```text
assets/characters/<slug>/
  reference.<ext>
  build.py
```

Those are the only required authored inputs.

- `<slug>` comes from the branch name and must contain only lowercase letters, digits and hyphens.
- Exactly one non-empty `reference.*` file must exist directly in the character directory.
- `build.py` is the character-specific Blender authoring script.
- The shared source rig is the current repository-default KayKit foundation model from `packages/characters/src/kaykit-foundation.js`, prepared by `scripts/prepare-kaykit-foundation.mjs` from its exact pinned upstream revision and Git blob.
- The active KayKit foundation is CC0 and uses the shared `Rig_Medium` contract. The carrier records the exact model id, rig id, license, upstream repository, revision, path, Git blob SHA and local SHA-256 in generated evidence.
- No `.dcc/character-dcc-request.json`, output-path declaration, reference hash declaration, rig hash declaration, stage declaration, or per-character workflow is authored by the character task.

The carrier derives hashes, source provenance, output paths and run metadata itself. A later repository-wide foundation migration is made in the KayKit foundation contract, not by reviving a character request manifest.

## Builder contract

After verifying the pinned KayKit bytes, the carrier copies that model into the generated build workspace and invokes the character builder through Blender headless:

```text
blender --background --python assets/characters/<slug>/build.py -- \
  --source generated/<slug>-dcc/input/source-rig.glb \
  --out generated/<slug>-dcc
```

The builder owns the character's visual identity and geometry. It must produce:

```text
generated/<slug>-dcc/source/*.blend
generated/<slug>-dcc/export/*.(glb|vrm)
generated/<slug>-dcc/review/front.png
generated/<slug>-dcc/review/three-quarter.png
generated/<slug>-dcc/review/side.png
generated/<slug>-dcc/review/back.png
generated/<slug>-dcc/build.json
```

Exactly one `.blend` and one runtime model (`.glb` or `.vrm`) are accepted. `build.json` must contain a non-empty `characterId`. Character-specific post-processing belongs inside `build.py`; the carrier does not guess VRM/GLB semantics and does not replace authored geometry with generic primitives.

## Automatic outputs

The carrier derives canonical paths from `<slug>` and commits them back to the same `dcc/<slug>` branch:

```text
assets/characters/<slug>/model.blend
apps/rinne/public/simulator/assets/<SLUG>_DCC.glb|vrm
docs/characters/qa/<slug>-dcc/
  front.png
  three-quarter.png
  side.png
  back.png
  blender-audit.json
  build.json
  integrity.json
```

`<SLUG>` is the upper-snake form of the branch slug.

`integrity.json` records the actual reference, builder, `.blend`, runtime model and shared foundation hashes; the foundation provenance includes its exact upstream repository/revision/path/Git blob, model id, rig id and license. The finalizer independently checks that the local shared-source bytes still match that pinned upstream Git blob before it writes the receipt.

The carrier is a build-and-evidence path only. Its receipt keeps `visualApproval=pending` and `productionReady=false`. It does not grant `PRIMARY`, `POLISH`, `MOTION`, `RUNTIME_READY`, device performance, or human visual approval, and it does not create a Character Production promotion manifest automatically. Those gates remain in the Character Production pipeline.

## Execution

`Character DCC Carrier` runs only on `dcc/**` pushes that change `assets/characters/**/build.py` or `assets/characters/**/reference.*`.

It:

1. derives `<slug>` from the branch and validates the two-file layout before installing Blender;
2. prepares the repository-default KayKit foundation from the fixed upstream revision and verifies the pinned bytes;
3. computes reference, builder and local foundation hashes automatically;
4. installs the repository-approved headless Blender runtime;
5. runs the character-specific builder for real;
6. runs `scripts/blender/character-production-audit.py` against the generated `.blend`;
7. requires the runtime model, editable `.blend`, four fixed review views and `build.json`;
8. derives canonical output paths and writes fail-closed `integrity.json`, including pinned-source provenance;
9. runs focused carrier tests plus `git diff --check`;
10. rechecks the authored inputs and shared foundation bytes before committing generated canonical evidence back to the same `dcc/<slug>` branch;
11. records `character-dcc/build` on the exact generated head.

The generated commit does not touch `build.py` or `reference.*`, so the path-filtered push workflow does not recursively rebuild itself.

## Future-session procedure

For a user request such as "このキャラをBlenderで作って", a future Chat/WORK should only:

1. start from latest `develop` and create `dcc/<slug>`;
2. place the character reference at `assets/characters/<slug>/reference.<ext>`;
3. implement `assets/characters/<slug>/build.py` against the `--source` / `--out` builder contract;
4. push once and perform one bounded carrier-state read;
5. on a later interaction, resume from the current branch/head and inspect the committed review views before any promotion decision.

Do not create a request manifest or a character-specific Actions workflow. Do not route ordinary Blender execution through RINNE Dispatch merely to obtain Blender.

## Recovery and safety

If the normal environment cannot run Blender locally, the `dcc/<slug>` push is the normal execution route. If transport fails, the standing delivery authorization permits the same branch to move through the connected GitHub API or repository Codespaces plus normal git without asking again.

A carrier failure remains on the same branch with its exact workflow run as the recovery point. Fix that branch and push the corrected `build.py` or reference. Do not weaken pinned-source verification, Blender audit, fixed review evidence, visual approval, `productionReady`, generated-file checks, or Integration exact-head gates to force success.
