# Motion Selection Final Pass

This work extends the existing shared motion runtime from correction and interaction into selection, semantic event timing, dependency ordering, interaction schemas, lightweight predictive locomotion, pose-search-lite diagnostics, contact constraints, motion variation, profiling and autonomous review inputs.

Acceptance scope:

- latest develop remains the delivery base; the complete verified motion stack from PR #222 is carried forward without weakening existing authority boundaries
- motion layers have an explicit dependency graph, per-layer ownership contract and deterministic execution order; conflicting writers fail closed in validation
- semantic motion events expose stable names such as foot-plant, weight-transfer, anticipation-end, weapon-release, contact, follow-through and handoff without replacing native gameplay contact clocks
- predictive locomotion derives a bounded future trajectory from current velocity plus explicit movement intent only; it never writes authoritative actor movement
- pose-search-lite ranks existing candidate poses/clips by trajectory, facing, support side, state and continuity features; it does not introduce ML/runtime asset downloads
- interaction schemas define reusable anchor roles, distance/yaw envelopes and release semantics for talk-close, handshake, hug, carry-child, grab, blade-clash, eat-target and grapple; schemas do not infer gameplay relationships
- weapon contact constraint returns bounded presentation-only deflection/recoil and never changes damage or collision authority
- motion variation uses a stable character seed for start foot, recovery amplitude, idle phase and presentation micro-variation without desynchronizing authoritative contact events
- lightweight motion profiler tracks per-layer CPU budget and recommends presentation LOD only; it cannot disable gameplay/contact/network authority
- autonomous review planning combines existing frame, trajectory, COM, collision and perception evidence into reproducible review requests; it never grants visual approval or edits source by itself
- shared contracts remain in `@soul/animations`; app adapters remain thin and apps do not import one another
- Shino authored slash duration/contact, Motion Warp target lock, swept weapon sampling, damage, save and multiplayer authority remain unchanged
- main / Production / independent Visual Review Lab branch remain out of scope

PR #222 remains untouched until this newer latest-develop final pass is Ready. Once Ready, this PR supersedes #222 to avoid duplicate Integration.
