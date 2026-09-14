# Motion Life Final Pass

This pass layers animation life, continuity and perceptual diagnostics on top of the existing motion-warp / mass-response foundation without changing gameplay authority.

## Runtime layers

- Anticipation / recovery: bounded overlays live inside each existing normalized attack phase. They do not extend the 0.66 s Shino slash or move contact windows.
- Gaze: neck/head aim tracks an explicit combat target when one is available and fades during follow-through or hit reaction.
- Dynamic grip: finger curl tightens toward contact and relaxes through recovery; two-handed weapons drive both hands while one-handed sword/katana keep the free hand relaxed.
- Secondary motion: a small capped spring may drive non-humanoid hair/clothing/accessory bones after the authoritative humanoid pose. It is commit-only and LOD-limited.
- Pose-space corrective: stressed shoulder/knee/hip envelopes produce bounded corrective weights. Runtime auto-correction is intentionally subtle so weapon sockets and planted feet are not replaced by a second solver.
- Combo momentum: recent technique direction can carry into the next technique with half-life decay. The same carry is applied to the rendered body and returned weapon transform so render/contact sampling stay aligned.
- Motion LOD: full/near/mid/far profiles progressively disable fingers, corrective work, secondary bones, gaze, terrain work and perceptual QA. The local hero remains full quality.

## Perceptual QA

- Readability QA projects body/weapon separation through eight deterministic yaw views and reports the weakest silhouette score. It is diagnostic evidence, not an aesthetic grade.
- Trajectory QA derives speed, acceleration, jerk, reversal count and high-jerk frames from ordered samples. It catches small oscillation and abrupt direction changes that finite-pose tests miss.
- `motion-perception-qa` can be attached to existing `character-motion-qa` v1. `visualApprovalRequired` must remain true and numeric diagnostics cannot set `visualApproval`.

## Authority boundaries

- actor/world translation, damage, contact windows and multiplayer/network state remain gameplay-owned.
- anticipation/recovery overlays keep existing attack clocks and authored contact timing.
- secondary motion and finger detail are presentation work and never write actor position.
- combo carry may adjust the sampled weapon transform only together with the same visual rotation; it does not add damage events or change the active/contact clock.
- gaze does not select or retarget combat targets; it only consumes an already-known target or optional presentation resolver.
- LOD may remove expensive detail but may not change hit timing, damage, root authority or saved game state.

## Review expectations

Focused automated checks cover pure-function bounds, browser/shared adapter parity, entry routing, commit-only secondary work and QA serialization. Integration browser gates must still verify the real WebGL renderer and mobile interaction. Human visual review remains required for silhouette, timing feel, secondary motion taste and reference-level quality.
