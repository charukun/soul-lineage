# Application structure

Runtime products and developer tools that use the shared workspace build/distribution system live under `apps/<id>`.

- `apps/rinne` — 100年生 — 輪廻転焦
- `apps/village` — MURAAAAAAA
- `apps/demon` — 尽喰廻遊
- `apps/review` — Visual Review Lab
- `apps/character-studio` — キャラクター工房
- `apps/eclipse` — standalone experimental game

Repository control-plane services keep dedicated top-level boundaries because they do not participate in the app workspace/artifact pipeline:

- `ops-board/` — PULSE
- `portal/` — WAYFINDER

Shared libraries stay under `packages/<id>`.

## DEV identity

One independently published DEV target owns one canonical URL and one PULSE identity.

- RINNE: `https://soul-lineage-rinne-dev.c-okamoto.workers.dev/`
- MURAAAAAAA: `https://soul-lineage-village-dev.c-okamoto.workers.dev/`
- 尽喰廻遊: `https://soul-lineage-demon-dev.c-okamoto.workers.dev/`
- Visual Review Lab: `https://soul-lineage-review-dev.c-okamoto.workers.dev/`
- Character Studio: `https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/`
- PULSE: `https://rinne-ops.c-okamoto.workers.dev/`
- WAYFINDER: `https://wayfinder-gallery.c-okamoto.workers.dev/`

GitHub Pages is not a DEV publisher. The RINNE `review.html` compatibility bridge may redirect to the independent Visual Review Lab, but PULSE/WAYFINDER must not surface that bridge as a second DEV target.

RINNE-only runtime probes such as battle, motion, equipment, objects, sound and effects remain internal RINNE views reached from Visual Review Lab. They are runtime inspection routes, not independently published applications.

This file is the canonical directory-boundary contract.
