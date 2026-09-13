# Final reusable asset intake — 2026-09-14

Base: `develop@850483da6b053edfd16428edf238b639072db90a`.

Purpose: finish the remaining asset review without disturbing the parallel Character Workshop, Shino motion, or Rinne UI work. Every recovered candidate ends in one of: ADOPTED, ADOPT-NOW, HOLD, or REJECT.

## Already adopted

- Kenney Fantasy Town Kit: MURAAAAAAA modular village geometry, CC0.
- Kenney Nature Kit / Pirate Kit: tent, campfire, soil, stone, pier, boat and later Nature GLBs, CC0.
- KayKit Dungeon Remastered: MURAAAAAAA furniture and 尽喰廻遊 environment props, CC0.
- KayKit Skeletons: Skeleton Minion ambient visual in 尽喰廻遊, CC0. Combat semantics are intentionally not attached.
- Kenney Particle Pack: repository-local spark/slash/smoke/flare textures used by 尽喰廻遊, CC0.

## Adopt now

- Lucide pinned UI SVG set from `lucide-icons/lucide@a79b2d131dab2bf20cb224bd0937b439a9c4fa99`. These are neutral reusable UI assets and do not compete with the active Rinne UI redesign. Store repository-local with license and expose through `@soul/assets`.
- Remaining audited Kenney Particle sprites that were part of the recovered asset manifest: `magic_01.png`, `circle_01.png`, `star_01.png`, `flame_01.png`. Store repository-local at the existing pinned Particle Pack commit. Current combat timing remains unchanged.

## Hold

- `norio/vrm-game-starter` + Quaternius animation source: useful, but owned by the parallel Shino motion / Character Motion pipeline. Do not duplicate it here.
- KayKit Skeleton Warrior / Mage as combat actors: source is usable, but attaching enemy AI/combat changes game semantics rather than asset intake. Keep the existing ambient-only Minion until an enemy-design task explicitly approves them.
- Previously mentioned Game Icons candidate: exact recovered source/provenance is absent from the repository ledger recovered for this task. Do not import an unverified replacement merely because a similar icon exists.
- `three-good-godrays`: visual technique candidate only. Hold until compatibility/performance against the current Three.js/post-process stack is explicitly validated.

## Reject for current canonical games

- KayKit Character Pack Adventures as the canonical human/NPC appearance: technically usable CC0 models, but the low-poly/chibi silhouette conflicts with the MasterCharacter/Character Workshop direction. Do not replace Shino or current human NPCs.
- KayKit Medieval Hexagon Pack as current village terrain/buildings: technically usable CC0 models, but hex-tile topology and low-poly language conflict with the current shared-world village art/terrain. Retain only as historical reference.
- RPGUI/Buch live theme: the recovered source itself records that it was removed from the live entry. Do not reintroduce it.

## Completion gate

This intake is complete when the ADOPT-NOW assets are repository-local with immutable provenance/license metadata, `@soul/assets` exposes the Lucide set, tests verify the pinned manifests, Fast CI succeeds, and the PR is Ready for Integration. No main/Production changes.
