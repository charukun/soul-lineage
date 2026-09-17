# Add shared 3D rendering budget diagnostics

Use the current `packages/rendering` performance stack to absorb the useful runtime lessons from the reviewed 3D Vibe Coding handbook without copying its non-commercial assets or source code.

Acceptance:

- extend shared texture diagnostics so large/uncompressed textures and estimated resident bytes are attributable to concrete texture usages instead of only returning aggregate counts;
- add a shared scene budget audit for material/draw-call pressure and static-instancing opportunities, while excluding skinned, morphed, interactive and explicitly protected content from unsafe optimization suggestions;
- keep diagnostics presentation-only: do not mutate gameplay, collision, save/network state or silently downscale production textures at runtime;
- preserve the existing adaptive-quality and visual-quality floors; this task identifies waste before lowering visible quality;
- add focused `packages/rendering` tests and expose the new diagnostics through the shared rendering exports;
- do not copy handbook assets/code, add paid dependencies, modify `main`, or weaken existing quality gates.
