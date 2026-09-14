# Motion Runtime Operationalization

This pass operationalizes the motion-selection/orchestration work as real game-facing presentation infrastructure while preserving gameplay, contact, save and network authority.

Acceptance scope:

- latest `develop` is the delivery base; prior unmerged motion PRs are source material only and must not become the merge base
- carry forward the verified motion quality / interaction / selection contracts without rolling back newer develop operations work
- build a deterministic pose-candidate bank from existing locomotion and attack/recovery states, then rank start frames using trajectory, facing, support side and continuity; selection remains presentation/advisory unless gameplay explicitly consumes it
- route semantic motion events to existing presentation consumers such as footstep/audio/VFX/camera hooks without making semantic `contact` authoritative for damage
- connect Interaction Schema adapters only where gameplay supplies an explicit partner and anchors; never infer relationships from generic state
- derive visual weapon-contact constraints from real swept/contact evidence when available, while preserving native hit/damage authority
- add foot-sliding diagnostics measured in world-space during planted windows, and linear/angular jerk diagnostics for pelvis/chest/head/limbs/weapon-tip trajectories
- expand Character Workshop Motion Debug with toggles for COM/support, future trajectory, foot locks, weapon arc, interaction anchors, hit direction, warp window, pose-search ranking and layer ownership
- expose crowd personal-space suggestions to Village navigation as a bounded optional presentation/navigation bias; never write resident state from animations
- expose the same crowd advisory to Demon human NPC movement only through an explicit adapter, without changing monster behavior or combat authority
- add motion performance calibration evidence fields for physical-device measurements while keeping design budgets distinct from measured Pixel Fold results
- integrate the new diagnostics into the existing autonomous review plan and Character Motion QA; diagnostics can request recapture/review but cannot edit source, auto-approve visuals or weaken gates
- actual ragdoll remains out of scope unless an existing physics backend is present; do not add a fake physics implementation
- preserve Shino authored slash duration/contact timing, Motion Warp target lock/no-homing/contact-stop and swept contact sampling
- main / Production / independent Visual Review Lab branch remain unchanged

Validation must cover affected shared packages/apps and record normal-speed visual approval as separate from numeric/browser checks.
