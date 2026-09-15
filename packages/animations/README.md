# @soul/animations

Portable humanoid motion quality contracts: rest-frame normalization/retargeting,
pose sanity policies, transition interpolation, capsule risks, weapon/body profiles,
deterministic review cameras, public-technique motion reference benchmarking and
validated QA JSON. No Three.js, DOM, game simulation or AI provider dependency. The
asset catalog remains empty; source motions are owned by the existing app/runtime
rather than copied into a fictitious package catalog.

`evaluateMotionReferenceBenchmark()` compares measured local-runtime evidence with a
pinned public technique reference without importing external code/assets. Use
`attachMotionReferenceBenchmark()` to keep that evidence inside the existing Motion
QA report as optional diagnostic metadata. It never sets `visualApproval`.

See [Motion Quality Pipeline](../../docs/characters/MOTION_QUALITY.md) and the
[current code-evidence baseline](../../docs/characters/qa/motion-reference-baseline-v1.md).
