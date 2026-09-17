# Optimize all three 3D runtimes in one pass

Apply the useful performance lessons from the reviewed 3D Vibe Coding handbook to the current Rinne, Village, and Demon runtimes using the repository's existing rendering stack.

Acceptance:

- optimize all three apps in this task, not diagnostics only;
- preserve gameplay, collision, save/network authority, current models, motion/contact timing, and visible quality floors;
- reduce repeated static draw calls using explicit safe world batching that can cross presentation-only transform parents without swallowing dynamic visibility/state;
- reduce avoidable per-frame allocations/traversals in the active hot loops;
- move Village tilt-shift to the bounded low-resolution shared miniature-focus pipeline while preserving the user tilt control and sharp gameplay/UI focus;
- keep Meshopt/KTX2/residency paths intact and refresh batching when async authored assets arrive;
- expose cached runtime budget/batch telemetry instead of adding new full-scene work every frame;
- validate shared rendering plus Rinne/Village/Demon focused contracts, then Ready -> READY_FOR_INTEGRATION;
- do not copy handbook code/assets, weaken quality gates, modify main, or publish Production.
