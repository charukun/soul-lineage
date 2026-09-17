# RRP Performance Contract

RRP performance claims use measured evidence, not one flattering score. Safety is a hard gate; performance is a vector; physical claims require physical provenance.

## Evidence classes

1. `model` — deterministic Reality Lab/proof model. Can reject a design, never certify a device.
2. `browser-synthetic` — real browser on a synthetic/reference environment. Regression evidence only.
3. `physical-device` — one physical device with explicit provenance.
4. `physical-multipeer` — two or more physical peers with device/network/runtime provenance. Required for multiplayer SLO certification.

Evidence is never silently promoted. Missing measurements stay `null`.

## Hard safety gates

Any non-zero value below makes the result a failure regardless of speed:

- committed Canon rollback;
- duplicate irreversible commit;
- stale authority epoch accepted;
- split-brain `OPEN` overlap;
- irreversible state visible before commit;
- recovery `OPEN` without committed recovery material.

## Performance vector

The machine contract records input→authoritative ACK and input→display p50/p95/p99, Canon commit p50/p95/p99, Host-loss detection/reopen p95, peer/Host uplink average/p95/peak, DataChannel queue peaks, state freshness, position error/missing rate, rollback rate/duration, connection success/TURN rate, frame/GPU p95, memory and battery. Reality Lab model metrics use the same namespace but remain `model` evidence.

The older Semantic Frontier dimensions (`wireBytes`, `latencyMs`, `coordination`, `connections`, `cpuWork`, `infraUnits`, `rollbackExposure`) remain useful for theoretical Pareto work. They do not substitute for physical measurements.

## Measurement boundaries

- `inputToAuthoritativeAckMs`: creation of an input protocol sample to receipt of authoritative state explicitly acknowledging that exact sequence after Host simulation applied it. This is a protocol-path metric, not touch-hardware latency.
- `inputToDisplayMs`: the same input creation time to the browser-frame boundary after `renderer.render()` submitted the first acknowledged authoritative state. The Guest records on the following `requestAnimationFrame`; this is conservative relative to JS/WebGL submit but is not photon/scanout latency. Packet receipt or prediction alone never ends the timer.
- `canonCommitMs`: irreversible intent creation to committed Canon becoming visible to the initiator.
- `hostLossDetectionMs`: old-Host loss to first migrating/darkness transition.
- `hostReopenMs`: migration start to successor `OPEN` with committed recovery material.
- uplink: application payload bytes in observed one-second buckets. A known idle bucket is zero. Unobserved gaps increment `bandwidthSkippedBuckets` and are never fabricated as idle traffic.
- DataChannel queue: browser `RTCDataChannel.bufferedAmount`; OS/radio queues are outside this metric.
- `stateFreshnessMs`: render-apply time minus the time of the newest authoritative state used by that render.
- `positionErrorM`: rendered interpolated/reconciled position versus authority at the same world time.
- `rollbackMs`: reversible world time already shown but invalidated by one correction. A measured zero-rollback interval is valid zero evidence.
- `connectionSuccessRate`: opened DataChannels / actual answer-accept attempts for the same profile. Creating an unused invite is not an attempt.
- `turnRelayRate`: relay-selected connections / connections whose selected candidate type could be classified. Unknown candidate type remains unknown.

## Anchored SLOs and calibration

Existing repository gates remain:

- Pixel-Fold-class frame p95 `<= 33.34 ms`;
- Host-loss detection p95 `<= 4500 ms`;
- migration start→successor `OPEN` p95 `<= 6000 ms`.

Metrics without an accepted product SLO do not self-certify from the first run. The first complete physical capture stays `calibration-required` until explicitly accepted as a baseline. Default regression ratchets then allow about 12% degradation for core latency/frame metrics, 15% for bandwidth/error/resource metrics, 20% for queue peaks, while connection success may not fall below 98% of its accepted baseline.

Minimum evidence floors are 300 ACK samples, 300 display samples, 20 Canon commits, 20 Host-loss/reopen observations, 120 observed Host/peer uplink buckets, 120 queue samples, 300 freshness samples, 300 position-error samples, a measured rollback interval, 20 connection attempts and 300 frame samples. These are development floors, not statistical-confidence claims.

For routed physical captures, percentile-like performance uses a **worst-endpoint envelope** rather than pooling all endpoint samples. A fast desktop therefore cannot hide a slow mobile peer behind a pooled p95. Endpoint-scoped certification floors use the least-sampled relevant endpoint, not the total sample count across peers.

## Dedicated physical capture route

Ordinary gameplay remains measurement-off. Use:

```text
?rrpCapture=1&rrpPeers=N
```

`N` defaults to 2 and must be 2–30. The query is preserved in invitation links, so joined peers enter the same capture mode and target.

Capture mode dynamically installs a bounded probe and exposes `window.__RRP_CAPTURE__`. `raw()` returns the current peer capture, `json()` returns printable JSON, `reset()` restarts a valid steady window, and the on-screen panel can copy raw JSON. The controller samples every 250 ms to keep one-second bandwidth observation alive.

A steady window arms only after the session is `OPEN` with at least `N` connected peers. Arming clears pre-cohort latency/bandwidth/frame samples while preserving connection-attempt/path counters. Manual reset is refused before the cohort exists. If the cohort drops after arming, the steady window is discarded and must arm again. This prevents an `N`-peer claim from silently containing an `N-1` interval. A future Host-failure capture mode must use a separate fault-window rule rather than weakening this steady gate.

Raw capture metadata includes role, world ID, peer ID, build revision, environment, expected peer count and armed state. Physical evidence built from this route rejects:

- unarmed windows;
- mixed routed/legacy captures;
- inconsistent peer targets or build revisions;
- a target that disagrees with `provenance.peers`;
- any world without exactly `N` unique endpoint captures;
- unobserved bandwidth gaps.

Host and Guest see the same WebRTC link, so connection counters are deduplicated per world using the Host endpoint when available; Guest counters are fallback evidence if a Host capture is unavailable.

The capture route currently wires applied-input ACK, post-render display timing, visible RAF frame intervals, application bandwidth, DataChannel queue pressure, rebirth commit timing, connection attempts/opens and ICE candidate classification. Host migration, state freshness/same-time position error, GPU/memory/battery and radio measurements remain missing until an honest runtime boundary exists.

## CLI

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs template --class physical-multipeer
node apps/rinne/scripts/rrp-performance-contract.mjs build --input /tmp/rrp-raw-capture.json
node apps/rinne/scripts/rrp-performance-contract.mjs validate --input /tmp/rrp-evidence.json --require-physical
node apps/rinne/scripts/rrp-performance-contract.mjs compare --baseline accepted-baseline.json --current current.json
```

Focused checks:

```sh
node --test apps/rinne/tests/reality-performance-contract.test.mjs apps/rinne/tests/coop-performance.test.mjs apps/rinne/tests/coop-session.test.mjs apps/rinne/tests/rrp-performance-cli.test.mjs apps/rinne/tests/rrp-performance-capture.test.mjs
```

The existing co-op browser gate also exercises the opt-in capture route and verifies ordinary gameplay does not install it.

## Next physical loop

1. Run repeatable 2–3 physical-peer steady captures on fixed Wi-Fi and collect the first real ACK/display, frame, bandwidth, queue, ICE-path and Canon-commit distributions.
2. Review and explicitly accept or reject that baseline. Do not invent new absolute SLOs before this evidence exists.
3. Add a dedicated fault-window route when real browser Host migration exists, then measure loss detection/reopen without reusing steady-window semantics.
4. Add state freshness/same-world-time position error when prediction/interpolation reaches the main co-op path.
5. Add GPU/memory/battery/radio evidence only where the platform exposes a defensible boundary.
6. Repeat on fixed WAN profiles, then expand toward the separate 30-device certification matrix.

No paid runtime or dedicated game server is introduced by this contract. NAT/TURN reachability, automatic Host migration, physical 30-device scale and battery/radio behavior remain unproved until their corresponding evidence exists.
