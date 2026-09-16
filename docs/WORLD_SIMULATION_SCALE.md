# Shared World Simulation Scale

## Goal

This layer raises the common world's CPU, navigation, network and persistence ceiling after the rendering/world-scale phases. It does not move combat, save, collision or multiplayer authority into presentation workers.

Stack order: Stylized target -> GPU/performance -> runtime resilience -> shared-world presentation scale -> **simulation scale**.

## Spatial index

`@soul/world/spatial-index` is the common broad-phase for nearby entity/object lookups. It uses a uniform grid and supports incremental frame updates, tagged radius queries and nearest lookup. Hot callers can provide their own output array through `queryRadiusInto()` so repeated proximity checks do not allocate a new array every frame.

MURAAAAAAA uses this for nearby guard, wildlife target, raid target and nearby defensive-building lookup instead of repeatedly filtering/sorting the full population/object list.

## Crowd navigation / Flow Field

The existing A* navigator remains the correctness fallback. `@soul/world/flow-field` builds a destination-centred integration field and shares it across actors travelling toward the same cell. Fields are keyed by world/traffic revision and maintained in a bounded LRU.

The flow-field builder:

- preserves eight-direction motion and diagonal corner blocking;
- retains the traffic/worn-path preference;
- bounds build radius and visited cells;
- uses a reusable heap-node pool to reduce allocation churn;
- returns `null` when it cannot safely provide a route, causing the existing A* implementation to run.

This is deliberately safer than replacing the existing navigation authority with an asynchronous worker in one step.

## Fixed-step and entity cadence

The village simulation runs through a 30 Hz fixed-step scheduler independent of render FPS. Catch-up work is bounded after background suspension.

Non-critical residents receive distance-aware decision cadence:

| Tier | Simulation cadence |
| --- | ---: |
| near / important / combat | 30 Hz |
| mid | 10 Hz |
| far | 3 Hz |
| distant | 1 Hz |
| dormant | 0.5 Hz |

Elapsed time accumulates between updates so timers, hunger and long-running state do not silently stop. Player, mayor, guards and combat-relevant actors are forced to the high-precision tier. Presentation animation has its own LOD contract and remains independent.

## Network transport LOD

The reliable WebRTC data channel remains the authority/control lane. A second optional presence channel is unordered with `maxRetransmits: 0`.

Use the reliable lane for join/reject, battle result and other state that must arrive. Use the presence lane for replaceable position/state snapshots.

`@soul/network/transport-lod`:

- consumes the existing 20 / 8 / 2 / 0.5 / 0 Hz presence policy;
- sends per-observer partial snapshot deltas;
- monitors `bufferedAmount` and drops stale replaceable presence before allowing transport queues to grow without bound;
- never drops the reliable battle-state transition because presence is congested.

The shared `RaidHost` exposes observer-specific snapshots without advancing gameplay per observer. This reusable infrastructure does not enable a player-village raid entry. The Village app preserves its explicit, invite-only exterior sightseeing snapshot and visitor role; the Demon online adapter remains disabled under `VILLAGE_VISUAL_AND_FRIEND_INVITE.md`.

## Snapshot interpolation and reconciliation

Remote presentation is buffered and interpolated at a short delay. A bounded extrapolation window covers brief packet gaps, after which presentation holds rather than predicting indefinitely.

A generic prediction reconciler distinguishes ordinary local error from teleport-class divergence. Small error is consumed as a decaying presentation correction; large error requests a snap.

Prediction reconciliation remains reusable shared infrastructure; the disabled Demon online adapter does not connect it to gameplay. World-scale presentation uses interpolation without rewriting authoritative player movement.

## Allocation and event-loop pressure

High-frequency histories use bounded `Float64Array` rings. Spatial queries can reuse caller output arrays. Flow-field heap nodes are pooled across builds. Snapshot interpolation uses fixed-capacity reusable sample slots.

`@soul/platform-web/runtime-profiler` records bounded timing histories for named CPU regions, Worker latency, Long Tasks and Event Timing where the browser exposes them. Browsers do not expose a portable direct GC event stream, so the implementation does not claim precise GC pause attribution.

## AudioWorklet

`@soul/platform-web/audio-worklet-mixer` provides a category mixer running in AudioWorklet when supported, with a direct AudioNode connection fallback when not supported. 尽喰廻遊 routes ambient and effect buses through this mixer without changing sound event semantics.

Audio LOD from the previous shared-world phase remains responsible for deciding which voices should exist; AudioWorklet is the mixing/execution layer.

## Incremental persistence

MURAAAAAAA retains the canonical full snapshot but adds an append-only journal:

- the base snapshot remains a complete recoverable save;
- subsequent saves store incremental operations, including ID-addressed entity patches;
- no-op saves do not advance persisted revision;
- journal revision gaps fail closed;
- count/byte limits trigger compaction into a fresh full snapshot;
- compaction first writes a shadow snapshot so interruption between writes can recover the newest complete revision;
- recovery backs up base, journal and compact shadow before removing them.

This is device-local persistence only. It does not turn browser storage into multiplayer authority.

## Browser evidence

Normal PR browser performance evidence can now include:

- fixed-step/cadence counters;
- spatial-index and flow-field diagnostics;
- Long Task / Event Timing / named CPU section summaries;
- network presence sent/drop/backpressure counts;
- interpolation/reconciliation diagnostics;
- AudioWorklet support state;
- existing frame/GPU/rendering/world-scale/resilience metrics.

## Safety boundaries

- gameplay/combat authority stays in existing game runtimes;
- collision ownership is unchanged;
- existing A* remains navigation fallback;
- reliable network events are not routed through the lossy presence channel;
- local player movement is not overwritten by presentation reconciliation;
- journal corruption/revision gaps fail closed rather than guessing;
- WebGL2 remains the production renderer;
- main / Production are not modified by implementation work.
