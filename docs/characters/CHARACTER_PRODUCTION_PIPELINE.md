# Character Production Pipeline v2

## Purpose

Character production must not collapse `reference -> some geometry -> implemented` into one step. The repository treats character work as a staged production process with explicit evidence and promotion gates:

`REFERENCE -> BLOCKOUT -> PRIMARY -> SECONDARY -> DEFORMATION -> MOTION -> POLISH -> RUNTIME_READY`

The executable contract lives in `packages/characters/src/production-pipeline.js`. Repository status is checked by `node scripts/check-character-production.mjs` and is included in affected `@soul/characters` validation. A worker may create or inspect a model at any stage, but may only claim the stage that the executable gate accepts.

A Three.js primitive/procedural character is useful for proportions, silhouette, runtime integration and motion plumbing. It is **BLOCKOUT**, not a production character. `SphereGeometry`, `BoxGeometry`, `CylinderGeometry`, runtime wardrobe shells and similar code-generated geometry must never be used as evidence that `PRIMARY`, `POLISH` or `RUNTIME_READY` is complete.

## Authority and boundaries

The following remain authoritative and are not replaced by this pipeline:

- `MASTER_CHARACTER.md`: provenance, license, audited asset, pooling and runtime ownership.
- `MODULAR_APPEARANCE.md`: approved modular appearance boundaries.
- `MOTION_QUALITY.md`: normalized motion, anatomical correction, weapon calibration and reproducible Motion QA.
- `CHARACTER_STUDIO.md`: Character Workshop ownership and browser review boundary.
- game code: inventory, combat, collision, save/network authority and gameplay eligibility.

This pipeline decides **production evidence and promotion state**. It does not grant inventory, change hitboxes, silently alter source animation timing, approve a license or replace human visual judgment.

## External technique reference

The public Coloso course page for 3D creator Lee, `https://coloso.jp/products/3dcreator-lee-jp`, is a non-normative technique reference. The repository generalizes only publicly described production ideas, not course assets or private lesson material. Relevant public concepts include:

- design poses around center of gravity, silhouette and line of action;
- build relaxed idle and combat idle as different functional states;
- author the transition between those states;
- make attacks begin from and return to a stable game pose;
- review small and large hit reactions, not only offensive motion;
- use anticipation, timing/spacing and game-facing exaggeration rather than literal real-world motion;
- verify motion from multiple camera directions so it remains usable in a game camera, not only one hero angle;
- treat facial performance and camera presentation as part of character appeal.

These ideas extend the existing repository Motion QA. They do not make the Coloso/Maya workflow a dependency. Blender is the default open DCC path; Maya or a reviewed imported asset is also allowed when provenance and export evidence are retained.

## Stage contract

### 1. REFERENCE

Goal: freeze what is being built before geometry work begins.

Required evidence:

- at least one repository reference path;
- front, side and back coverage;
- `intentLocked=true` after checking identity, head/body ratio, face, hair, clothing, equipment and palette.

A reference image or reference preset is not a 3D model. Character Workshop must show it as `REFERENCE`, not production-ready.

### 2. BLOCKOUT

Goal: test proportion, volume and silhouette cheaply.

Required evidence:

- front / side / back / three-quarter review;
- proportions reviewed;
- silhouette reviewed.

Allowed implementation:

- Three.js primitives and procedural geometry;
- rough Blender/Maya blockout;
- temporary proxy clothing/gear.

`runtime-procedural` has a hard maximum stage of `BLOCKOUT`. The executable gate rejects attempts to promote it to `PRIMARY` or later.

### 3. PRIMARY

Goal: establish real character topology and the large forms that define identity.

Required evidence:

- DCC-authored Blender/Maya mesh or reviewed imported mesh;
- retained source mesh path;
- topology review;
- UV review;
- separate skin, hair and clothing surfaces.

For DCC-authored assets the manifest records tool, tool version and source file. High-fidelity character work should normally use:

`Astra/worker -> Blender source -> headless audit -> GLB/VRM export -> Workshop/Lab`

not:

`Astra/worker -> Three.js primitives -> production claim`.

### 4. SECONDARY

Goal: move beyond the large mannequin forms.

Review hair masses, garment construction, footwear, armor, belts, bags, accessories and role-defining gear. Hair, clothing and accessories each require explicit review evidence. Decorative detail must follow the reference rather than compensate for incorrect large forms.

### 5. DEFORMATION

Goal: prove the model survives animation before animation quality is judged.

Required poses:

- neutral;
- head turn;
- arm raise;
- elbow bend;
- knee bend;
- crouch.

Also require weight review, self-intersection review and clothing/hair collision review. Do not repair every bad deformation by distorting the motion; fix topology/weights when the model is the cause.

### 6. MOTION

Goal: prove the character functions as a game character, not a static turntable.

Minimum motion set:

- relaxed idle;
- combat idle;
- relaxed -> combat transition;
- walk;
- run;
- attack;
- small hit reaction;
- large hit reaction;
- weapon draw;
- weapon sheathe.

Review at least eight camera directions. The motion manifest must explicitly confirm:

- center of gravity reads correctly;
- silhouette remains legible;
- line of action supports the intent;
- anticipation exists where required;
- timing and spacing carry weight;
- exaggeration serves game readability rather than literal realism;
- motion works across camera variants;
- actions return to a stable pose where the gameplay contract expects it.

`MOTION_QUALITY.md` remains the source for anatomy, transition continuity, collision proxies and weapon grip. The production gate adds artistic/game-function evidence rather than replacing numeric QA.

### 7. POLISH

Goal: remove the blockout/AI-placeholder look and approve the authored asset.

Minimum expression evidence:

- neutral;
- blink;
- smile;
- mouth open.

Minimum material evidence:

- base color;
- roughness;
- metallic channel reviewed where applicable;
- normal/detail normal strategy reviewed.

Hair/clothing secondary motion must be reviewed. `visualApproval` must be exactly `approved`. Metrics without visual approval do not pass this stage.

### 8. RUNTIME_READY

Goal: prove the polished asset works in the shipping WebGL path.

Required runtime evidence:

- GLB/glTF/VRM format;
- exact asset hash;
- provenance reviewed;
- license reviewed;
- WebGL2 runtime success;
- desktop p95 <= 16.67 ms;
- Pixel Fold-class mobile p95 <= 33.34 ms;
- triangle count, draw calls and texture-memory measurement recorded;
- Pixel Fold-class device category recorded;
- at least eight final runtime review views.

These thresholds match the existing MasterCharacter target. Passing them does not authorize main/Production promotion; normal Integration/Production gates still apply.

## Manifest

Each production character keeps a `*.production.json` file under `packages/characters/production/`. The authoritative executable validator accepts schema `character-production`, version `2`.

Example skeleton:

```json
{
  "schema": "character-production",
  "version": 2,
  "id": "character.example.v1",
  "stage": "PRIMARY",
  "modelingMode": "dcc-blender",
  "source": {
    "referencePaths": ["docs/characters/references/example/front.png"],
    "meshPath": "assets/characters/example.glb",
    "dcc": {
      "tool": "Blender",
      "version": "4.x",
      "sourcePath": "art/characters/example.blend"
    }
  },
  "evidence": {}
}
```

Do not advance `stage` first and fill evidence later. Add evidence, run the checker, then promote the declared stage.

## Blender/headless route

When Blender is available, keep the `.blend` source outside generated review output and run:

```sh
blender --background path/to/character.blend \
  --python scripts/blender/character-production-audit.py -- \
  --character-id character.example.v1 \
  --out generated/character.example.v1.dcc-audit.json
```

The audit records Blender version, mesh/armature counts, triangles, materials, UV presence, shape keys, bones and unapplied transforms. It is objective DCC evidence only. It deliberately writes `visualApproval: pending` because topology quality, silhouette, skinning, material quality and appeal cannot be certified from counts.

If Blender is unavailable in one transient worker, do not downgrade the pipeline to primitives and call it finished. Preserve the branch/PR and switch to an execution route that can run the DCC step, including Codespaces or another authorized environment. The repository artifact and manifest remain the handoff coordinate.

## Astra / implementation-worker procedure

For any request that creates or substantially changes a character model:

1. Read this document, `MASTER_CHARACTER.md`, `MOTION_QUALITY.md` and the target reference.
2. Inspect existing source assets and production manifest before destructive changes.
3. Determine the current stage. Never infer `RUNTIME_READY` from a model merely loading in Three.js.
4. Work only toward the next justified stage. Do not skip evidence stages.
5. If only runtime/procedural geometry can be produced, stop the model claim at `BLOCKOUT`; implementation may still wire it into review tools.
6. Prefer Blender for PRIMARY onward. Keep the editable source and exported runtime asset linked by hashes/manifest evidence.
7. Run deformation poses before spending time polishing motion.
8. Run relaxed/combat/transition/attack/reaction motion review under fixed multi-view cameras.
9. Run Polish visual review and require explicit approval.
10. Measure actual runtime budgets and record provenance/license before setting `RUNTIME_READY`.
11. Run `npm run characters:production:check` and affected fast validation before Ready for review.

A worker report must say the real stage. Phrases such as "production model", "completed 3D character", "implementation-ready" or "game-ready" are forbidden for `REFERENCE`/`BLOCKOUT` assets.

## Character Workshop and Visual Review Lab

Character Workshop is the stable place for model/body/rig/deformation/Motion QA. It should display the production stage for reference models. Generated crowd variants remain a generation/quality preview and are not individually promoted to production assets.

Visual Review Lab is the fast artistic review surface. A Lab entry can exist before production readiness, but the UI/report must preserve the stage. Lab publication is not evidence of `RUNTIME_READY` by itself.

Fixed cameras and before/after evidence should be reused across revisions. The production stage must not change because a different camera makes a defect less visible.

## Current reference-derived characters

The existing reference-derived runtime/procedural characters are **BLOCKOUTS**. Their ability to appear in Visual Review Lab, use the common rig or play motion does not make them PRIMARY/POLISH/RUNTIME_READY. They must be rebuilt through a DCC-authored mesh path and promoted through this pipeline before being treated as finished game characters.

The current `shino.reference.v2` on develop is a dedicated `runtime-reference-model`, so its explicit repository stage is `BLOCKOUT` with `runtime-procedural` modeling mode. It remains non-production geometry until a DCC-authored model advances through the later evidence stages. `scripts/check-character-production.mjs` applies the same classification to every runtime reference character, preventing the old "procedural geometry == production model" classification from returning.

## Validation commands

```sh
npm run characters:production:check
node --test packages/characters/tests/production-pipeline.test.mjs
node scripts/validate.mjs fast origin/develop HEAD
```

The affected fast gate runs the production checker whenever `@soul/characters` is selected. Full validation runs it as well. Do not weaken the gate to integrate a higher-stage claim without evidence.
