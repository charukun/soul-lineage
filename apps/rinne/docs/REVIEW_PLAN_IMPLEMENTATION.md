# Visual Review Lab usability and motion correction

Implements the owner's approved audit plan from build f31b6a901f91. The de2ba490 combat Idle is retained. Concurrent fb670ea notebook, native draw/sheathe, cumulative sequence playback and editable feedback are explicitly reconciled. PR23 remains Draft; no develop/main/Production publication is authorized.

## Motion and review state

Normalized clips are baked through the official VRMHumanoid.update conversion into the visible raw mesh bones. Resetting the visible skeleton is followed by explicit interpolant writes: AnimationMixer's unchanged-value cache must not leave paused/stepped poses at rest. The original audited model and its textures are retained.

Tidebreak / Attack is a review-only authored right straight (1.45 seconds including preparation/return). It starts and ends in guard, has staged pelvis/chest/arm progression, bounded reach, guarded offhand, planted support foot and returning balance. Mirrored anatomical finger hinges and thumb opposition replace a spread thumb. The exact timings and coordinates are art choices, not measured mocap or a claim to reproduce one specific martial-arts school. Shared simulator motions.js, damage timing and game rules are unchanged. A distinct natural idle is separate from the concurrent combat Idle.

Weapons have per-model grip, axis, scale and left-support points, plus measured palm sockets. The katana retains its curved blade and corrected guard. Dedicated review slash checkpoints follow preparation, cut, follow-through and return, preserving the source full-body clip. Incompatible weapon/punch combinations are labelled as comparisons. Native draw/sheathe clips still come from the game's actual weaponDraw transition, not reversed attacks. Their hip/hand transfer uses the corrected grip and does not recapture a hip transform in an async load race.

A single state includes model, clip/sequence, posture, actual weapon ID and visibility, offsets, speed, pause, repeat, time, camera preset and VFX. Shared URLs restore those fields without applying new-selection defaults. Missing sequence stages are never skipped. Feedback remains editable with explicit Copy and confirmation actions; its URL captures the current state rather than a stale address.

## Controls and integrity

The main view has direct motion selection, playback, speed/repeat, phase checkpoints, camera, model, posture and weapon. Detailed numeric controls and the existing staged/axis/posture tools remain in the detailed section. Main preview and control scrolling are separately bounded for portrait and landscape. Feedback is reachable alongside the camera controls even on short screens.

Thirteen checked-in converted VRMA hashes are verified. Seven converted byte lengths differ from the original source lengths by 20 bytes; the ledger checks the actual review conversion without disabling any content hash/size validation. Unsupported external VRM0 retargeting is reported as partial availability, not a successful full load.

## Basis and limits

Official conversion reference: https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMHumanoid.html
Migration: https://github.com/pixiv/three-vrm/wiki/Migration-Guide
Whole-body punch research reviewed: https://pubmed.ncbi.nlm.nih.gov/29192550/ , https://pubmed.ncbi.nlm.nih.gov/29609507/ , https://pubmed.ncbi.nlm.nih.gov/22005009/

These sources motivate coordination and correct rig conversion, not our exact authored trajectory, universal style rules, impact forces or injury calculations. This is game animation, not martial-arts instruction or a medical model.

Fast tests cover state/sequence roundtrips, exact asset integrity, native posture contracts, anatomical thumb closure, real Shino skeleton conversion, reverse/paused seeks and finite transforms. The skeleton-only tests omit textures and are not visual evidence. The browser test separately loads real textured models, checks nine weapons and support, punch/slash phases, native draw/sheathe, staged playback/feedback, exact URL state, eight model choices and five screen sizes. Screenshots, video, trace, JSON and source SHA are recorded. Existing assertions are retained.

The existing Review build and dedicated Cloudflare Preview workflow are unchanged. Diagnostic workflows/source materializers remain only on the isolated validation branch and are not application delivery. Passing math tests, browser checks, publishing, physical Pixel Fold performance and human visual approval are distinct. No physical-device performance or motion-capture authenticity is claimed.
