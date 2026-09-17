# Tidebreak authored combat effects

## Scope

Integrate openly licensed, externally authored effects as reproducible reference data for Rinne combat. Coordinate with PR #728 (Tidebreak combat core) through its existing presentation events, without editing its combat implementation or changing damage, input, stamina, saves, or native contact timing.

## Acceptance

- Preserve upstream effect data, attribution, license, source revision and a reproducible acquisition path. Do not label AI-generated approximations as the imported originals.
- Add attack/contact/finisher presentation at real actor/target positions, respecting existing animation timing. Do not invent hits for misses, guards or evades.
- Keep renderer/SDK integration in presentation adapters. No browser or rendering dependencies in combat/domain code.
- Bound simultaneous effects and lifetime; reuse resources; stop and dispose on scene teardown. A missing or failed optional asset must not stop gameplay.
- Use the existing Rinne renderer; do not create a second game, canvas, combat simulation or global postprocessing stack.
- Validate event mapping, duplicate handling, budgets and cleanup with focused tests. Distinguish these from unperformed real-device visual/performance verification.
- PR #728 owns combat changes. This work is a separate develop-targeted PR with `Depends-On: #728`; Integration owns final merge and publication.

## Visual acceptance

Compare imported originals and in-game playback for silhouette, peak intensity and decay. Normal contacts should be sharp and readable; finishers may use larger shockwaves without obscuring opponents or interaction UI. Pixel Fold frame time and actual motion synchronization remain explicit runtime evidence, never inferred from unit tests.
