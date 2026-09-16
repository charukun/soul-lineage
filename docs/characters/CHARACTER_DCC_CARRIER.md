# Character DCC Carrier

## Purpose

Character DCC Carrier is the repository-wide Blender execution path for character builds. Future sessions should not recreate a per-character workflow or a request manifest.

The authored input is deliberately tiny so the modeling work stays character-specific while execution stays reusable.

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

- `<slug>` is taken from the branch name and must be lowercase letters, digits and hyphens.
- exactly one `reference.*` file must exist directly in the character directory;
- `build.py` is the character-specific Blender authoring script;
- the shared audited rig is `apps/rinne/public/simulator/assets/SHINO_review.vrm` unless the repository standard changes globally;
- no `.dcc/character-dcc-request.json`, output-path declaration, reference hash declaration, rig hash declaration, stage declaration, or per-character workflow is required.

The carrier computes hashes, output paths and run metadata itself.

## Builder contract

The carrier invokes the character builder through Blender headless:

```text
blender --background --python assets/characters/<slug>/build.py -- \
  --source generated/<slug>-dcc/input/source-rig.glb \
  --source-vrm apps/rinne/public/simulator/assets/SHINO_review.vrm \
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

The carrier derives all canonical paths from `<slug>` and commits them back to the same `dcc/<slug>` branch:

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

The integrity record contains the actual reference, rig, `.blend` and runtime-model SHA-256 values plus Blender/audit facts. The carrier is a build-and-evidence path only: it does not grant human visual approval, `productionReady`, `POLISH`, `MOTION` or `RUNTIME_READY`, and it does not create a Character Production promotion manifest automatically.

## Execution

`Character DCC Carrier` runs only on `dcc/**` pushes that change `assets/characters/**/build.py` or `assets/characters/**/reference.*`.

It:

1. derives `<slug>` from the branch and validates the two-file layout before installing Blender;
2. computes reference and rig hashes automatically;
3. installs the repository-approved headless Blender runtime;
4. runs the character-specific builder for real;
5. runs `scripts/blender/character-production-audit.py` against the generated `.blend`;
6. requires the runtime model, editable `.blend`, four fixed review views and `build.json`;
7. derives canonical output paths and writes `integrity.json`;
8. runs focused carrier tests plus `git diff --check`;
9. commits generated canonical evidence back to the same `dcc/<slug>` branch;
10. records `character-dcc/build` on the exact generated head.

The generated commit does not touch `build.py` or `reference.*`, so the path-filtered push workflow does not recursively rebuild itself.

## Future-session procedure

For a user request such as "このキャラをBlenderで作って", a future Chat/WORK should only:

1. start from latest `develop` and create `dcc/<slug>`;
2. place the character reference at `assets/characters/<slug>/reference.<ext>`;
3. implement `assets/characters/<slug>/build.py`;
4. push once and perform one bounded carrier-state read;
5. on a later interaction, resume from the current branch/head and inspect the committed review views.

Do not create a request manifest or a character-specific Actions workflow. Do not route ordinary Blender execution through RINNE Dispatch merely to obtain Blender.

## Recovery and safety

If the normal environment cannot run Blender locally, the `dcc/<slug>` push is the normal execution route. If transport fails, the standing delivery authorization permits the same branch to move through the connected GitHub API or repository Codespaces plus normal git without asking again.

A carrier failure remains on the same branch with its exact workflow run as the recovery point. Fix that branch and push the corrected `build.py` or reference. Do not weaken Blender audit or generated-file checks to force success.
