# Visual Review architecture

## Ownership

Visual Review Lab is a hub across app-owned review surfaces.

```text
apps/review/                         Visual Review Lab hub / experiments
apps/rinne/                          百年転生 application
  index.html                         game entry
  review/
    motion/index.html                RINNE-owned review surfaces
    equipment/index.html
    objects/index.html
    effects/index.html
    sound/index.html
    battle/index.html
  src/review/
    motion/
    equipment/
    objects/
    effects/
    sound/
    battle/
    shared/
apps/character-studio/src/review/    Character Studio-owned review domains

packages/shared-ui/src/review/       cross-app review UI
packages/rendering/src/review/       cross-app review rendering lifecycle
```

The Lab links to these surfaces. It does not own RINNE runtime implementation, and RINNE review code does not move into `apps/review`.

## Public routing

RINNE's public review routes remain canonical and extensionless:

- `/review-motion`
- `/review-assets`
- `/review-objects`
- `/review-effects`
- `/review-sound`
- `/review-battle`

The nested `apps/rinne/review/*/index.html` files are source/build entrypoints, not public route names.

## Reference model

Motion Review is the golden reference for review ergonomics. Shared review infrastructure is extracted from its behavior without forcing Motion Review to consume a generic layout that changes its established presentation.

## Rules

1. Each app owns review surfaces that require its runtime.
2. `apps/review` owns the Lab hub and independent experiments only.
3. Cross-app UI belongs in `packages/shared-ui/src/review/`.
4. Cross-app renderer/camera/framing/disposal belongs in `packages/rendering/src/review/`.
5. App review roots contain domain folders and entrypoints, not duplicate shared widgets.
6. New review surfaces reuse shared stage lifecycle, camera, loading/status, disposal, navigation and slot picker before adding local equivalents.
7. Public review URLs and user-visible behavior stay stable during structural refactors.
8. Legacy root entrypoints may remain as temporary compatibility facades, but canonical implementation belongs under `review/` and `src/review/`.
