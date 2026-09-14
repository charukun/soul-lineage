# Mass Response Final Pass

This pass turns the existing motion-quality contracts into runtime body response while preserving gameplay authority.

## Runtime additions

- Directional full-body hit reaction: actual reaction serials produce one canonical Impact Beat, then pelvis, spine, chest and head respond according to incoming direction, region and strength.
- Weapon inertia: presentation-only blade lag and overshoot are bounded per weapon family. Non-commit weapon/contact sampling remains authoritative and unchanged.
- Center-of-mass support QA: committed poses estimate weighted COM and report support margin against planted feet. This is diagnostic evidence only and cannot approve visual quality.
- Terrain-aware foot IK: an optional synchronous terrain sampler can split height correction between pelvis and feet and align soles to local normals. It is disabled when no sampler exists and does not modify authored attack/recovery footwork.

## Shared contract

`@soul/animations/gameplay-motion-quality` owns portable pure primitives for Impact Beat v2, directional reaction, weapon inertia, COM/support balance and terrain foot adjustments. The Rinne adapter has focused parity tests so future Village/Demon consumers can reuse the same rules without importing Rinne gameplay code.

## Authority boundaries

- actor/world transforms, damage, contact, multiplayer/network state stay gameplay-owned.
- weapon inertia is render-commit only and cannot move swept collision samples.
- Impact Beat coordinates presentation channels but does not create a second damage event.
- terrain adjustment is presentation IK and cannot change authoritative actor position.
- COM balance is QA evidence, not an automatic animation rewrite or visual approval.

## Validation expectations

Focused regression covers shared primitive bounds and symmetry, Rinne/shared adapter parity, actual humanoid entry routing through the dynamics layer, commit-only weapon inertia, attack-excluded terrain adjustment, and canonical Impact Beat fanout. Full app/build/browser validation remains the normal Ready/Integration gate.
