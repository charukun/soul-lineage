# Character25D Rig Runtime / Character Forge

Character25D v2 is a session/local-draft Actor, not a replacement for the approved
character registry. The canonical entry is Visual Review Lab `/review-hybrid-25d`.

## Boundaries

- `packages/assets/src/character25d-schema.js`: generic identity, v2 validation,
  immutable v1 migration, appearance, rig, motion, proxy and provenance.
- `character25d-rig.js`: deterministic humanoid proportions, common 18-bone hierarchy,
  body-part influence regions and triangulated UV meshes. Runtime limbs never scale.
- `character25d-motion.js`: reusable idle, walk, run, turn, attack, hit, talk,
  pickup and rest tracks. The existing RINNE opposite-arm/leg gait convention is
  retained with smaller, bounded image-space rotations; full 3D clips are not
  blindly retargeted onto a drawing that lacks occluded surfaces.
- `character25d-proxy.js`: world transform, smoothed yaw, actual movement velocity,
  capsule footprint/height, swept collision port, ground probe, slope/step limits.
- `adapters/three/character25d-actor.js`: invisible 3D skeleton, interaction/hand/
  weapon/hitbox/hurtbox sockets, layered skinned meshes, shared texture ownership,
  view hysteresis and crossfade, bounded hair/hem/accessory springs.

The gameplay-facing visual boundary is `setTransform`, `setVelocity`, `setFacing`,
`setAction`/`play`, `setGroundNormal`, `setEquipment`, `update`, `dispose`. Sockets
are real Object3D transforms on the 3D body; they never grant damage/interaction
authority. Hosts supply world collision and ground queries. RINNE reuses its
existing `sweepAndSlide` and `canMoveTo`; its current player walk surface is the
flat y=0 plane. The Playground also exercises a small slope and solid obstacle.

## One image compiler

The browser keeps the original bytes and SHA-256, detects separated full-body
view candidates, removes border-connected background and detached sheet captions,
measures alpha bounds/proportions, assigns a humanoid skeleton and mesh influence
regions, associates views, initializes physics and springs, and binds the motion
library. It stores a v2 draft locally and starts the Playground. Original pixels
are sampled through unchanged UVs; it does not generate faces or hidden artwork.

Provenance retains source hash/dimensions, parent hashes and crop rectangles,
background/segmentation/rig algorithm versions, schema version, derived=true,
generated=false, and unverified author/license. No image goes to a remote service.
Neither successful compilation nor a browser test changes Production approval.

## Controls and real game

Click the Playground and use WASD, Shift to run, Space to attack, E to interact,
H to try a hit, Q to gesture, R to rest and T to turn. Drag the stage for the 360°
camera. A thumbstick plus run/attack/interaction controls provides mobile input;
the action selector covers every clip without a wall of action buttons.

`RINNEで確認` creates an expiring, one-use opener/token transfer to DEV/local only.
The companion is rendered only in the active village, follows the player, turns,
walks/runs and idles using the same Actor. It is never added to save, family, NPC,
inventory, life or combat state. RINNE has no import/settings/summon panel.
The guest bootstrap is lazy and absent from ordinary game entry and Production.

## Compatibility and detach conditions

The v1 schema, raster validator, atlas renderer and local database remain intact.
Pose-backed v1 drafts can migrate into the v2 rig while retaining their original
atlas records and source bytes. Atlas-only bundles keep their actual v1 playback.
Old crop/atlas/bundle controls live inside the advanced disclosure. They can be
removed when existing local drafts have migrated and atlas-only drafts no longer
need authoring. The session companion can be removed once approved v2 assets use
the normal registry; portable schema, compiler and runtime do not depend on it.

## Limitations when adding many characters

- Template rigging targets upright humanoids with separated full-body silhouettes.
  Complex photographic backgrounds, crouching/overlapping limbs, extreme coats,
  nonhumanoids and text touching the body need clean source material or advanced
  crop correction. The source is preserved for recovery.
- A front-only drawing remains front-only. Side/back pixels cannot be recovered
  from it; provide one sheet containing those views for full view coverage.
- Three-view association is a candidate heuristic: front/side/back left-to-right.
  Side/back can be reassociated in advanced controls. No side is mirrored; the
  opposite side is explicitly an unmirrored view fallback. Asymmetric far-side
  equipment needs its own art before an accurate full turnaround can be approved.
- Hair/cloth/accessory labels are influence regions, not semantic segmentation.
  Their subtle spring motion cannot reconstruct hidden limbs or detached equipment.
  Large combat poses are bounded gestures until suitable additional artwork exists.
- Capsule collision delegates to the host; this slice has no general rigid-body
  simulation, dynamic prop pushing or pathfinding. Companion sliding may wait
  behind a blocker. Ground following is demonstrated on the Playground slope;
  RINNE currently exposes its existing flat walk plane.
- The budget is 1,440 triangles per view, at most two visible views during fade,
  a shared decoded texture per distinct image, 18 bones and three scalar springs.
  No postprocess or cloth solver is added. Desktop 60fps / Pixel Fold 30fps are
  targets, not physical-device measurements or automatic production certification.
- License/author and art quality review are still human work for each new source.

## Specialist evidence

Explicit tests: `tests/character25d-runtime.test.mjs`,
`tests/character25d-disposal.test.mjs`, legacy `tests/shino25d-pipeline.test.mjs`.
`tests/character25d-browser.test.mjs` explicitly builds Review and RINNE and runs
`scripts/browser/character25d-forge.mjs` on an exact hosted checkout. It records
actual keyboard/pointer input, changing rig states, video, views, actions, mobile
input, the real-game transfer, save isolation, and console errors beneath
`test-results/character25d-forge`. It is declared only for specialist work; no
workflow, automatic routine test sweep or build lifecycle was added.

The read-only canvas snapshot exposes render/proxy observations only in these
review/opt-in surfaces. This compensates for a current inspection gap and may
be removed once visual/interaction verification is equally reliable without it.
