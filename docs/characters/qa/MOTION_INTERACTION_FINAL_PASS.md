# Motion Interaction Final Pass

This work extends the current motion-quality stack from single-character presentation into paired interaction, locomotion transitions, motion personality and degraded-body states while preserving gameplay authority.

Acceptance scope:

- two-body interaction anchors coordinate both participants without letting presentation own gameplay position, hitboxes, damage or network state
- start / stop / pivot / turn-in-place select the planted side and remain bounded presentation corrections
- motion personality changes timing amplitude, posture, gaze and secondary motion without changing authored contact clocks
- fatigue / injury modulates posture, stride intent and limb presentation from explicit normalized state only
- paired combat response shares one authoritative impact serial and produces equal-and-opposite presentation impulses without a second damage event
- network reconciliation defines which motion fields must be deterministic and which presentation fields may be reconstructed locally
- shared contracts live in `@soul/animations`; app adapters remain thin and apps never import one another
- existing Shino slash duration/contact, swept weapon sampling, Motion Warp target lock and multiplayer authority remain unchanged
- numeric QA is diagnostic only; normal-speed visual review remains required for aesthetic approval

The implementation supersedes PR #209 by carrying its verified motion-quality files onto the latest develop before adding this pass. Main / Production and the independent Visual Review Lab branch remain out of scope.
