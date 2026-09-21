# Visual Review architecture

## Goal

Motion Review is the golden reference for review ergonomics. Shared review infrastructure must be extracted from that behavior without making Motion Review consume a generic layout that changes its established presentation.

## Layers

```text
packages/shared-ui/src/review/
  shell.js          navigation / review switching
  stage.js          stage lifecycle / settings portal
  controls.css      shared control primitives
  workbench.css     motion-derived patterns for other views
  slot-picker.js    generic selection UI
  status.js         loading / ready / error presentation
  thumbnail.js      static thumbnail primitive

packages/rendering/src/review/
  preview-stage.js  renderer / camera / framing / disposal

apps/rinne/src/review/
  motion/           motion catalog, registry, sources, equipment
  equipment/        equipment review domain
  objects/          object review domain
  effects/          effect review domain
  sound/            sound review domain
  battle/           battle review domain
  shared/           RINNE-only review adapters

apps/character-studio/src/review/
  character/        character review domain
  motion/           motion QA
  workspace/        editing workspace
  qa/               art / quality QA
```

## Rules

1. Motion Review presentation is the reference, not a consumer of generic workbench layout classes.
2. Shared packages own cross-app UI and rendering lifecycle only. Game or character domain logic stays in its app.
3. App review roots contain entrypoints or domain folders, not duplicate shared widgets.
4. New review surfaces reuse shared stage lifecycle, camera, loading/status, disposal, navigation and slot picker before adding local equivalents.
5. Public review URLs and user-visible behavior stay stable during structural refactors.
6. Compatibility entrypoints may remain temporarily, but implementation belongs under the domain folders above.
