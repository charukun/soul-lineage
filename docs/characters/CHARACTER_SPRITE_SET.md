# Character Sprite Set v1

`rinne.character-sprite-set/v1` is the formal action-sheet interchange format. It is independent of the legacy `rinne.character25d/v1` (Shino Idle/Walk atlas) and `rinne.character25d/v2` (image-derived rig). Forge may eventually emit this format; neither importing nor running it invokes Forge, a generative service, or image analysis.

## Files and identity

The authoring unit is `manifest.json` plus one transparent PNG per action, for example `idle.png`, `walk.png`, `attack.png`, `jump.png`. A portable `rinne.character-sprite-bundle/v1` wraps `{schema, manifest, images}`; `images` maps asset IDs to PNG data URLs. The Review importer accepts either the complete file selection or this one-file bundle. The export uses the same schema. RINNE consumes the same verified bundle and Three adapter.

The manifest contains:

- `schema`, arbitrary stable `id`, human `label`, integer `revision`, `stage`.
- `directions`: exactly `front, frontRight, right, backRight, back, backLeft, left, frontLeft`.
- `render`: `frameSize:[width,height]`, `pivot:[u,v]`, `worldHeight`, optional `shadowAnchor`, `shadowRadius`, `occlusionCategory`.
- `assets`: ID -> `{file, sha256, byteLength, width, height, mediaType:'image/png', hasTransparency:true, provenance}`.
- `actions`: action -> `{asset, rows:8, columns, fps, directionOrder, loop?, oneShot?, events?, pivot?, rootOffset?, travelHint?, anchors?}`.
- `provenance`, `approval`, optional common `anchors` and `weaponVariants`.

`apps/review/public/sprite-sets/kaykit-knight/manifest.json` is the complete executable example. The schema/validator's canonical implementation is `packages/assets/src/character-sprite-set.js`; no application owns a divergent schema copy.

## Grid, scale and view coordinates

Rows are directions; columns are chronological frames. Direction order is fixed and repeated explicitly in each clip. A v1 set uses one common frame canvas size across all actions, which keeps world scale invariant. This does not require a giant atlas: each action references its own sheet. Columns and FPS may differ between actions. An authoring tool can normalize older layouts before writing this format; the legacy UI remains available separately.

PNG backgrounds must be transparent, every cell must have visible content and some transparent pixels, and dimensions must exactly match the grid. Import verifies PNG signature/IHDR dimensions before decoding, SHA-256, byte length, actual decoded dimensions, transparency and nonempty cells. Limits are 32 assets, 8 MiB per PNG, 32 MiB encoded total, 4096 maximum edge, 16,777,216 decoded pixels total and 1 MiB manifest. Bundle transport is bounded to 46 MiB. Invalid or missing files fail closed; external URLs, traversal and duplicate paths are rejected.

`pivot` is normalized within the frame, with origin at its top left. `worldHeight` is the height of the whole frame canvas, not an automatically inferred body height. The declared pivot lands at the actor's world root. Action pivot overrides support a different pose baseline without changing pixel/world scale. Artists must keep the actual feet consistent with that declared point. Schema tests prove the coordinate math, not anatomical contact in arbitrary artwork.

Actor yaw zero faces +Z. Camera azimuth is `atan2(camera.x-actor.x, camera.z-actor.z)`; relative angle is camera azimuth minus actor yaw. Positive 45 degrees selects frontRight. These are authored signed views, never mirrored substitutes. A previous sector is retained through an extra 0.09 radians beyond its 22.5-degree half-width. Near-vertical camera positions retain the last useful azimuth. The Three adapter resolves against the actual render camera in `onBeforeRender`, so a camera director or existing RINNE camera update cannot leave a stale selected view.

## Actions, time and events

The core playable profile requires idle, walk, run, turn, attack, hit, talk, pickup, rest. Starter parkour requires jump, fall, and at least one of vault/climb. The fixture contains all thirteen. Its authored sit-down/rest clip is explicitly one-shot and holds the seated terminal frame instead of repeatedly standing and sitting. Draft schema validation permits a partial set; Review's gameplay Playground and RINNE transfer require the playable profile. Additional actions (guard, attackHeavy, death, land, dash, celebrate, etc.) are ordinary named clips, not enum changes to the engine.

Loop defaults: idle/walk/run/talk/rest/fall/climb loop; other names default to one-shot. `loop` or `oneShot` overrides the default; contradictory declarations are rejected. One-shots hold their final frame and emit one completion notification. The caller owns subsequent state transitions. Explicit preview loop overrides do not rewrite the manifest. Pause freezes the clock. Reset returns the current clip to frame zero, preserving pause. Missing actions throw instead of silently claiming coverage.

`events:[{frame:0,name:'takeoff'},{frame:3,name:'strike'}]` uses zero-based frames. Frame zero is emitted when a clip starts; crossed frames are emitted once, including loop wraps and valid catch-up steps. Completion is separate. The runtime accepts deltas from 0 to 10 seconds; hosts bound their simulation steps. Events are presentation notifications only. They must not award damage/items, move the world body, or replace RINNE's authoritative combat clock. Consumers drain the event queue after stepping.

`rootOffset:[x,y,z]` is a cosmetic local/world-unit body offset. `travelHint:[x,y,z]` is authoring metadata, never automatically applied movement. Actual motion is the caller's collision/ground controller. The sample sandbox uses existing Character25D proxy math and, inside RINNE, its existing `canMoveTo`, `sampleActorGround`, and `sweepAndSlide` hooks. Its bounded jump/fall height is separate from the ground-contact root; the contact shadow stays on sampled ground. Vault/climb clips are starter presentation, not a general ledge solver or permission to pass through walls.

## Hybrid equipment extension

Body artwork need not contain a weapon or shadow. Common `anchors` and per-action `anchors[direction][frame][socket]` use `[u,v,depth/worldHeight]`. Reserved socket names include body, rightHand, leftHand, weapon, secondaryGrip, weaponHitbox, trailOrigin, heldItem. Optional custom names are supported. Missing anchor data marks a socket unavailable, rather than inventing a hand position. These are projected presentation anchors, not a claim that a full 3D skeleton or authoritative hitbox exists.

`weaponVariants:{sword:{attack:'attackSword'}}` selects an ordinary alternate clip when the caller passes the weapon ID. This leaves room for existing RINNE equipment state and shared 3D weapon assets without a copy per sprite character. Full hybrid hand occlusion, two-handed IK, weapon-specific attack timing and combat hitbox binding remain a later integration. Caller-owned attachments are detached, not destroyed, on actor disposal.

## Provenance and approval

Top-level provenance records schema version, original source SHA-256, author/license strings, rights state and derived-processing history. Each PNG records original source SHA-256, actual imported-file SHA-256, dimensions, processing operations and byte length. The sample additionally pins the CC0 KayKit repository revision, Git blob and baker source commit. Each action records the exact source clip or authored skeletal fallback.

A local draft must have `productionApproved:false`. The schema represents approved records with verified rights and an approval receipt, but a JSON claim is not an authorization capability: the browser importer retains the claim as an annotation and downgrades imported sets to local-draft. It never manufactures human visual approval or Production Ready. Unknown author/license remains unknown. Normal game casting/distribution is not changed by this DEV-only session route.

## Review and RINNE route

`/review-hybrid-25d` is now the formal Sprite Set Playground. It exposes manifest/bundle import, the static sample, all actions, automatic/manual view, camera rotation, actor yaw, loop/one-shot, pause/reset, event/provenance inspection, a 3D ground/occluder stage, and bundle export. Its option grids keep five columns on desktop and mobile.

`/review-hybrid-25d?legacy25d=1` preserves the old Forge/workshop and v1/v2 coexisting preview. No legacy bundle is relabeled as a playable formal set.

The Review button opens RINNE with `character25d=actor&spriteSet=1&spriteTransfer=<nonce>`. A source-window, origin and nonce checked handshake transfers one bundle. Only DEV/local accept it; Production does not. The user enters the village through normal game controls. The sandbox then moves and plays the action circuit, and the Review controls can send action/demo/pause/reset commands to that same session. There is no permanent game debug panel, upload, localStorage/IndexedDB write, new save field, NPC replacement, or normal 3D-runtime substitution. Snapshots are read-only evidence boundaries.

## Authoring and validation

`node scripts/sprite-set/bake-sample.mjs` is an explicit offline authoring task, not a runtime step or default build hook. It verifies a pinned existing CC0 Knight GLB, bakes thirteen separate PNGs, captures direction-specific hand anchors, verifies the imported set in a browser, and writes the static fixture. A future Forge can instead produce these same files. It need not know Review or RINNE internals.

Focused tests cover schema/order, grounding/UV, signed view hysteresis, action timing, loop/one-shot events, pause/reset, variants and disposal. Specialist browser verification uses the exact candidate builds, real UI action changes and camera input, real RINNE village entry and movement, plus PNG hash/dimension checks and renderer-resource disposal. It retains source SHA, screenshots, video, trace, snapshots and console errors. Software WebGL evidence is not a physical Pixel Fold performance claim or human art approval.

## Remaining boundaries

This slice does not author every weapon/body variation, large-monster multi-part sheets, a generic ledge/ladder solver, or automatic Forge image synthesis. Those require additional authored frames/anchors and dedicated gameplay adapters. Drawing consistent multi-frame, eight-direction artwork remains a real production cost. The Knight fixture is a technical sample using source clips or recorded skeletal fallback, not a new original protagonist or final art-direction approval.
