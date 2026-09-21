# Visual Review architecture

## Goal

Motion Review is the golden reference for review ergonomics. Shared review infrastructure is extracted from that behavior without making Motion Review consume a generic layout that changes its established presentation.

## Ownership

Visual Review Lab is a hub across multiple app-owned review surfaces.

```text
apps/review/                    Visual Review Lab hub and review-only experiments
apps/rinne/                     百年転生 app
  review-*.html                 stable public review entrypoints
  src/review/                   百年転生-owned review implementation
apps/character-studio/          Character Studio app
  src/review/                   character-owned review implementation
packages/shared-ui/src/review/  cross-app review UI
packages/rendering/src/review/  cross-app review rendering
```

RINNE review pages stay owned by the RINNE app because they load RINNE runtime/domain code directly. The Lab links to them rather than moving their implementation into `apps/review`.

The root `review-*.html` files are intentionally retained because the canonical public URLs remain `/review-motion`, `/review-assets`, `/review-objects`, `/review-effects`, `/review-sound`, and `/review-battle`. They are public entrypoints, not implementation folders.

## RINNE review domains

```text
apps/rinne/src/review/
  motion/
    entrypoint.js
    catalog.js
    registry.js
    sources.js
    source-runtime.js
    models.js
    equipment.js
    humanoid-calibrations.js
    index.css
    library.css
    preview.css
  equipment/
    entrypoint.js
    catalog.js
    index.css
  objects/
    entrypoint.js
    catalog.js
    index.css
  effects/
    entrypoint.js
    catalog.js
    model-scale.js
    index.css
  sound/
    entrypoint.js
    catalog.js
    index.css
  battle/
    entrypoint.js
    stage.js
    state.js
    choreography-lab.js
    inspiration.js
    hero-motion.js
    monster.js
    equipment.js
    technique-composition.js
    index.css
  shared/
    lab-shell.js
    runtime-thumbnail.js
    slot-auto.js
    curated-library.js
    kenney-library.js
```

Compatibility files such as `src/review-motion.js` and `src/review-motion.css` remain thin facades during migration. New implementation belongs under `src/review/<domain>/`.

## Shared layers

```text
packages/shared-ui/src/review/
  shell.js
  stage.js
  controls.css
  workbench.css
  slot-picker.js
  status.js
  thumbnail.js
  navigation.js

packages/rendering/src/review/
  preview-stage.js
```

## Rules

1. Motion Review presentation is the reference, not a consumer of generic workbench layout classes.
2. Each app owns review surfaces that depend on its runtime/domain code.
3. `apps/review` is the Lab hub and home for review-only experiments, not a dumping ground for other apps' runtime code.
4. Shared packages own cross-app UI and rendering lifecycle only.
5. App review roots contain domain folders; legacy flat files are compatibility facades only.
6. New review surfaces reuse shared stage lifecycle, camera, loading/status, disposal, navigation and slot picker before adding local equivalents.
7. Public review URLs and user-visible behavior stay stable during structural refactors.
