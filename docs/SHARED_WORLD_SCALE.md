# Shared World Scale Architecture

This layer lets MURAAAAAAA, 尽喰廻遊 and future common-world consumers scale to many visible/present actors without moving gameplay authority into rendering code.

## Canonical importance policy

`@soul/world/scale-policy` defines the canonical presentation bands:

| Band | Distance | Crowd | Animation | Presence | Audio |
| --- | ---: | --- | ---: | ---: | --- |
| near | <= 18 | Master / full | 60 Hz | 20 Hz detailed | individual spatial |
| mid | <= 48 | reduced | 30 Hz | 8 Hz | individual spatial |
| far | <= 92 | proxy | 12 Hz | 2 Hz | category mix |
| distant | <= 168 | impostor | 4 Hz | 0.5 Hz | ambience |
| dormant | farther | hidden/presence only | 0 | 0 | none |

Adaptive quality can pull non-critical thresholds inward. Local, combat and important entities are protected as near importance regardless of raw distance.

Network and audio packages intentionally keep dependency-free adapter tables with contract tests against the canonical world policy. This avoids introducing circular/lockfile-sensitive workspace dependencies while preventing policy drift.

## Worker boundary

`@soul/platform-web/world-scale-worker` moves world-scale planning off the main thread. It receives plain focus/entity data and returns presentation budgets. It never owns:

- simulation or game time
- combat/damage/hit authority
- save data
- network authority
- object placement or collision

If Worker creation, postMessage, or response timing fails, the same deterministic kernel runs synchronously. Worker failure therefore reduces performance, not correctness.

OffscreenCanvas/WebGPU are not required for this phase. Three.js WebGL2 remains the production renderer on the main thread.

## Crowd path

Existing MasterCharacter actors keep their gameplay Object3D and current quality pipeline. The shared planner can cap NPC visual animation sampling through `crowdAnimationHz`; Hero/Shino ignores that crowd cap.

Remote/ambient far presence can be represented by `createCrowdPresenceRenderer()`, which uses two InstancedMesh draws for simple body/head proxies. Existing actors are hidden by the crowd helper only when explicitly marked `crowdProxyEligible`.

## Presence / interest management

`@soul/network/presence-lod` provides observer-distance policies, field stripping, position quantisation and send cadence. `RaidHost.tick(dt)` remains backwards compatible. `tick(dt,{observerId})` or `snapshotFor()` can produce observer-specific snapshots while leaving the authoritative peer/battle state untouched.

## Audio LOD

`@soul/audio/audio-lod` limits individual voices and changes distant sound semantics from spatial voices to category mix to ambience. It is a planning/voice-budget contract. Existing sound emitters must explicitly consume the plan; this layer does not silently rewrite gameplay audio events.

## Asset residency

`@soul/platform-web/asset-residency` caches repository-local binary visual assets in Cache Storage with build/source hashes and an in-memory front cache. The compressed GLTF loader can consume the residency cache before parse. New build versions use a new cache namespace and old namespaces can be pruned.

## Device capability

The initial quality tier uses available browser/WebGL signals such as hardware concurrency, deviceMemory when available, DPR and WebGL limits. This is a capability estimate, not physical temperature telemetry. Existing GPU/frame/thermal-trend governors still adapt after boot.

## Deterministic replay

`@soul/rendering/replay-benchmark` produces fixed-seed world-scale scenarios covering village center, denser market movement, weather pressure, combat surge and return-home. Performance Lab stores the world-scale report next to frame/GPU reports. `npm run world-scale:replay` also exercises the pure planner without a browser.

## WebGPU experiment boundary

`@soul/rendering/webgpu-experimental` only probes adapter capability. WebGL2 is always the default. WebGPU is selected only by an explicit experimental request and is not a production migration in this phase.

## Safety

This layer changes presentation, update cadence and data visibility only. It does not move or weaken combat, saves, collision, ownership, progression or multiplayer authority. main / Production remain out of scope unless explicitly approved.
