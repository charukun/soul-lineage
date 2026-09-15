# Runtime Visual Resilience

This document extends the Stylized Low / Mid Poly performance pipeline with long-session stability and quality-floor rules.

## Principle

Rendering may degrade gracefully; gameplay authority may not. Simulation, collision, damage, saves and multiplayer state remain outside every recovery/quality path in this document.

## Shader warmup

Actual scene material variants are compiled during idle/boot work with `WebGLRenderer.compileAsync()` when available. Hidden registered roots are exposed only while compiling and restored immediately. A bounded shader-variant budget prevents uncontrolled material permutation growth.

尽喰廻遊 additionally primes its existing `spark` / `slash` visual paths off-screen so first combat does not pay their initial shader compilation cost.

## Resource lifetime and leak gate

`@soul/rendering/resource-lifetime` provides a reference-counted registry. It disposes only resources explicitly marked as runtime-owned; shared authored/template assets are observed but never guessed to be disposable.

The leak sentinel compares `renderer.info.memory` only when the same stable scene key is revisited. Geometry, texture and shader-program growth beyond the configured tolerance fails the runtime/browser evidence gate instead of treating legitimate world growth as a leak.

## WebGL context recovery

`webglcontextlost` is prevented from triggering an uncontrolled page failure. Three.js remains responsible for rebuilding its internal GL objects after restoration; the app-owned hook reapplies resize/render-target state, shadow refresh, resource registration and shader warmup.

Game/save/network state is not reconstructed or reset by this path.

## Baked lighting and Light Probe

A restrained spherical-harmonic LightProbe supplements the existing Cool Ambient × Warm Local lighting. Authored `lightMap` and `aoMap` materials receive the shared intensity contract when present. Existing direct lights remain the readable key/fill source, so this is not an unlit downgrade.

## Silhouette impostor LOD

Eligible static groups can generate an eight-direction silhouette atlas from their own mesh vertices without GPU framebuffer readback. Far presentation swaps source meshes for a camera-facing card and restores their previous visibility when returning near.

Hero, enemy, interaction-critical and explicitly protected objects are never eligible. MURAAAAAAA remains conservative and only opts explicit/set-dressing roots into this path; 尽喰廻遊 can use it for non-critical environment chunks.

## Thermal trend governor

Web browsers do not expose a reliable device-temperature API. The system therefore never claims Celsius or direct thermal telemetry.

Instead, five-second rolling frame/GPU samples establish an early baseline. Sustained long-horizon degradation raises an inferred `warm` or `hot` pressure state and sets a minimum adaptive-quality tier. Short combat spikes do not immediately trigger thermal pressure. Recovery requires a longer stable period than degradation.

## Visual quality floor

Adaptive quality must not remove the parts of the image that define the game.

- Hero/reference: high VFX floor, 4× anisotropy floor, full motion, no occlusion/impostor downgrade.
- Enemy: readable VFX and texture floor, no occlusion/impostor downgrade for the active enemy/player presentation.
- Critical landmark/light: no occlusion/impostor downgrade.
- NPC/environment: may continue to use distance/animation/occlusion/impostor savings.

This makes the governor priority-aware rather than treating every pixel as equal.

## Browser evidence

Normal PR browser artifacts include runtime performance plus resilience state. The browser gate fails if:

- the stable-scene resource leak sentinel fails,
- context recovery reaches `failed` or `exhausted`, or
- shader warmup records an error.

These checks add evidence to the existing smoke path; they do not replace gameplay clarity assertions.

## Targets

- Desktop: 60 fps class.
- Pixel Fold-class mobile: 30 fps class.
- Long sessions should not show unbounded renderer geometry/texture/program growth for the same stable scene.
- Adaptive/thermal reduction must preserve Hero/enemy readability and key combat feedback.

## Boundaries

- no gameplay simulation changes
- no collision/damage authority changes
- no save/schema changes
- no network authority changes
- no claim of direct physical temperature measurement
- no destructive runtime decimation of skinned/morphed characters
- no main / Production change from implementation work
