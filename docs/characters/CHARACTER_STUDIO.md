# Character Studio usability delivery

The studio at `apps/rinne/characters.html` is a production inspection tool, not a breeding game. It keeps the audited Shino and modular geometry from PR #65 unchanged.

## Workflow

Start with a single adult in view. Choose a body part, then one of its four existing choices. The selected individual is always explicit. Colors and age affect that individual only. Diagnostic poses and expressions are separate from parts. The Comparison tab changes visibility/count only: it never randomizes or replaces edited profiles. Numbered individual buttons return to focused editing. Camera tools remain next to the viewport.

The document uses one viewport with a stationary preview and a separately scrolling editor body. Toolbar, tabs, undo/redo and save stay reachable. Small portrait and landscape layouts are explicit. The detailed page also uses independently scrolling controls rather than a document-height sticky preview.

## Editing continuity

The renderer exposes a bounded inspection session API. `character-workspace-state.js` validates the original review schema plus per-record modular slots. Unknown versions/IDs/parts, duplicate IDs and oversized documents reject. Legacy review JSON is still readable; it did not contain modular parts and imports with none.

The browser adapter stores only `rinne.character-studio.workspace.v1`. No game save, inventory, host authority or network connection is accessed. Main/detail navigation and reload restore the same records, selected individual, parts and notes. Explicit JSON export includes faces, hair, body, clothing and accessories as well as prior review data; it is not a VRM export or asset adoption into a game. Browser storage failures are reported and JSON export remains available. Undo/redo is a bounded 40-step in-page history. Camera movements and comparison display changes are not randomized edits. The temporary original-parts preview never replaces the saved profile.

## Honest limits

This changes usability, not asset quality. Face and body options are proportions; alternate hair/clothing are the existing initial geometry kit and clothing overlays. Final production character assets, facial topology, multi-peer behavior and physical Pixel Fold performance are not certified here. Software-WebGL checks validate functionality, not device performance.

## Validation

Source-contract tests keep the audit, loading bounds and both build entries. New workspace tests cover versions, malformed imports, round-trip parts and history. The existing affected browser lane calls the focused real-Shino studio test when character UI changes. It checks stationary preview bounds at 320/360/390/412/768/844/1280 widths, paused part switching, actual replacement-hair visibility, undo/redo, 12/30-view edit retention, selected-only changes and main/detail/JSON/reload continuity. Screenshots and JSON results are in the existing browser artifact directory.

The user explicitly requested DEV deployment. PR/head-specific Integration review, code gates, Pages/OIDC delivery and public source verification remain required; main and Production are unchanged.

## Motion QA delivery contract

Character Workshop owns repeatable character/rig/body-variation motion QA; Visual Review Lab owns detailed skill/VFX choreography. The shared `packages/animations` quality layer must remain model-provider independent and presentation-only. Review results must retain character, source motion, frame/time, deterministic camera, affected bones, severity, cause category, status and before/after evidence. Numeric diagnostics never substitute for visual approval.

The initial acceptance case is Shino arm/torso penetration, followed by body/height/age variants and a 6/12-character cohort. Existing authored combat timing and expression must be preserved. Future vision workers consume and produce the same review contract without embedding a model API in the game.

The **Motion QA** tab now supplies a 30-second source review, 8 fixed cameras,
before/after, frame stepping, 1/6/12/30 comparison and structured issue JSON.
See [Motion Quality Pipeline](MOTION_QUALITY.md) for the implementation, first case,
validation and remaining visual/device gates.

## NPC role-reference integration

The ten sheets under `docs/characters/references/npc-role-set/` are `CONCEPT TARGET / PARTIALLY MAPPED` design targets for diversity, not replacements for runtime truth. Character Workshop exposes them as reference cards and reports which visible traits are already representable by the current modular kit versus which remain proposed.

The runtime-facing contract is metadata-first. `@soul/characters` describes each reference archetype with age, visual role, existing modular slots, reference image and coverage boundaries. Existing implemented slots influence deterministic generation only when the mapping uses a runtime part that actually exists. The Child Girl and Elderly Woman targets add two approved low-cost modular pieces, `hair:bun` and `accessory:ribbon`; normal seed-based visual identity generation can also produce these additions. A concept-only prop, armor detail, body feature, hairstyle, garment or gameplay item remains explicitly proposed or game-owned until separately authored and approved.

Workshop comparison lets a reviewer choose a target archetype, regenerate 1/6/12/30 deterministic characters for that target, inspect the sheet beside the 3D stage, and see a coverage report split into `IMPLEMENTED MODULAR PARTS`, `PROPOSED PARTS`, and `GAME EQUIPMENT`. The existing free/mixed generation mode remains available and is not replaced by reference-targeted generation.

Initial archetypes: child boy, child girl, elderly man, elderly woman, guard, knight, blacksmith, laborer, hunter and arcanist. Child/elder references constrain age bands; role references map to existing display roles and existing role gear where possible. This integration does not change Character save/schema, combat stats, hitboxes, inventory, network authority, lifecycle rules, or the audited Shino MasterCharacter.
