# RRP Performance Contract

This document is the performance contract for the Rinne communication architecture. Safety and correctness are hard gates; performance is evaluated as a vector rather than collapsed into a single flattering score.

## Evidence classes

Evidence is always labelled as one of these classes and may not be silently promoted:

1. `model` — deterministic Reality Lab / proof-model evidence. Useful for algorithmic comparisons, not a device claim.
2. `browser-synthetic` — real browser runtime on a synthetic/reference environment. Useful for regressions, not a physical-device claim.
3. `physical-device` — one physical device with explicit provenance. Useful for render/runtime budgets, not multi-peer WAN certification.
4. `physical-multipeer` — two or more physical peers with device/network/runtime provenance. Required for end-to-end multiplayer SLO certification.

`model` and `browser-synthetic` evidence can reject a design, but cannot certify physical multiplayer performance. Missing measurements are `null`, never synthetic zeroes.

## Hard safety gates

A result is invalid regardless of speed when any of the following is non-zero:

- committed canon rollback;
- duplicate irreversible commit;
- stale authority epoch accepted;
- split-brain OPEN overlap;
- irreversible state made visible before commit;
- recovery OPEN without the committed recovery material.

Performance optimization runs only inside this safety envelope. A faster unsafe result is a failure, not a Pareto improvement.

## Performance vector

The machine-readable contract records:

- input-to-authoritative-ack p50/p95/p99;
- input-to-rendered-display p50/p95/p99;
- canon commit p50/p95/p99;
- Host-loss detection p95 and migration-start-to-reopen p95;
- average/p95/peak peer uplink and Host uplink;
- maximum reliable and presence DataChannel buffered bytes;
- state freshness age p95/p99;
- position error p95/max and missing-sample rate;
- rollback frequency, p95 duration and maximum duration;
- connection success rate and TURN relay rate when a real ICE path is measured;
- frame p95, GPU p95, memory and battery/energy when the evidence source can measure them.

The older Semantic Frontier dimensions (`wireBytes`, `latencyMs`, `coordination`, `connections`, `cpuWork`, `infraUnits`, `rollbackExposure`) remain useful for theoretical Pareto comparison. They are not substitutes for these physical metrics.

## Measurement semantics

Use these boundaries consistently so two captures are comparable.

- `inputToAuthoritativeAckMs`: local input creation to receipt of the first authoritative state that explicitly acknowledges that exact input was applied by the Host simulation. If a newer input supersedes an older un-applied input, the older input is not fabricated as a latency sample.
- `inputToDisplayMs`: local input creation to the browser-frame boundary after `renderer.render()` submitted the first authoritative state containing that applied input. The runtime calls `inputDisplayed(seq)` only after that authoritative state was submitted to WebGL, and the Guest records the sample on the following `requestAnimationFrame`. This is deliberately conservative relative to the JavaScript render-submit point, but it is still not a photon/scanout measurement. Network receipt alone never ends the timer, and a prediction-only frame never ends it either.
- `canonCommitMs`: irreversible intent creation to the committed Canon revision becoming visible to the initiator. Pre-commit animation does not end the timer.
- `hostLossDetectionMs`: injected/observed old-Host loss to the first `MIGRATING`/darkness transition.
- `hostReopenMs`: migration start to the successor becoming `OPEN` with the committed recovery material.
- `peerUplinkKbps` / `hostUplinkKbps`: application payload bytes in fixed one-second buckets. An explicitly observed idle bucket is zero. If the probe is not sampled across multiple buckets, those intervening buckets are counted in `bandwidthSkippedBuckets` and omitted rather than fabricated as idle traffic. The dedicated capture route must therefore sample continuously for a comparable bandwidth run.
- `reliableBufferedAmountBytes` / `presenceBufferedAmountBytes`: sample `RTCDataChannel.bufferedAmount`. This is the user-agent send queue only; it does not include OS/network hardware buffering.
- `stateFreshnessMs`: render-apply time minus the timestamp/tick time of the newest authoritative state used by that render.
- `positionErrorM`: displayed interpolated/reconciled position versus the authoritative position for the same world time. Do not compare values at different ticks.
- `rollbackMs`: amount of already presented reversible world time invalidated by one correction. If a measured interval has zero rollbacks, rate/p95/max are measured zero, not unknown.
- `connectionSuccessRate`: successful DataChannel opens divided by actual connection attempts using the same timeout and network profile. Merely creating an unused invite is not a Host-side attempt; accepting an answer is. When Host and Guest raw captures from the same world are merged, the Host endpoint is the canonical link counter so one WebRTC connection is not counted twice. A world without a surviving Host capture falls back to its Guest endpoint counters.
- `turnRelayRate`: connections whose selected candidate pair can be classified as relay divided only by connections whose selected candidate type could actually be established. It remains `null` when candidate classification is unavailable instead of assuming zero TURN usage.

`RTCPeerConnection.getStats()` is used only when the browser exposes the needed selected-candidate dictionaries. Data-channel-specific stats are not uniformly available, so application send counters remain the portable payload source. `RTCDataChannel.bufferedAmount` is sampled directly for queue pressure.

## Existing anchored SLOs

These values already exist elsewhere in the repository and are carried forward rather than reinvented here:

- Pixel-Fold-class physical frame target: frame p95 <= 33.34 ms (30 fps class), with the existing minimum sample contract.
- Host loss to migrating/darkness detection: <= 4500 ms.
- Migration start to reopened successor Host: <= 6000 ms.
- Current Rinne authority simulation cadence is 20 Hz and published results are approximately 10 Hz; these are workload facts, not proof that end-to-end latency is acceptable.

## Calibration floors and baseline acceptance

Metrics that did not previously have an accepted product SLO do **not** pass merely because a first physical capture produced a number. The first compatible physical-multipeer capture remains `calibration-required` until it is explicitly accepted as the comparison baseline. This prevents an arbitrary first measurement, including a bad one, from certifying itself.

Before baseline acceptance, the capture must at least contain:

- 300 input-to-authoritative-ack samples and 300 input-to-rendered-display samples;
- 20 Canon commits;
- 20 Host-loss and 20 successor-reopen observations;
- 120 observed one-second peer-uplink and Host-uplink buckets;
- 120 samples for each DataChannel buffer maximum source;
- 300 freshness samples and 300 position-error samples;
- a measured rollback interval; zero rollback is valid evidence for that interval;
- 20 connection attempts;
- 300 frame samples.

These are minimum evidence floors for this development contract, not a claim of statistical confidence or an industry standard. Captures below a floor are `calibration-required`, never a pass.

After a baseline is explicitly accepted, regression checking uses both an existing absolute SLO where one exists and a baseline ratchet. The default regression guard permits at most roughly 12% degradation for core latency/frame metrics, 15% for bandwidth/error/resource metrics and 20% for DataChannel queue peaks. `connectionSuccessRate` is handled separately as higher-is-better and may not fall below 98% of its accepted baseline. These ratios are regression guards, not product SLOs.

## Runtime capture route

Normal gameplay remains measurement-off. The physical capture surface is enabled explicitly by opening the normal Rinne app with `?rrpCapture=1`. That route opens the co-op surface and installs the opt-in bounded performance probe; ordinary URLs do not install it.

While capture mode is active:

- Host/Guest sessions receive an explicit performance probe. Normal sessions do not create the probe, call `getStats()`, UTF-8-count every outgoing message, or retain measurement arrays.
- The capture controller samples `session.performance()` every 250 ms, keeping the one-second bandwidth observation boundary alive while foreground execution is healthy. Browser throttling/background gaps become `bandwidthSkippedBuckets` rather than zero traffic and invalidate a physical-multipeer evidence build.
- `window.__RRP_CAPTURE__.raw()` exposes the current peer raw capture object, `json()` returns printable JSON, and the capture panel can copy that JSON. Raw objects include `_capture.role`, `_capture.worldId`, build revision and environment so Host/Guest endpoint evidence can be merged without double-counting physical links.
- The capture controls move into the modal while the co-op dialog is open and back to the normal document while gameplay is active, so the controls remain reachable across the capture flow.
- Guest input creation and authoritative acknowledgement preserve the exact sequence timer until the authoritative state is submitted to WebGL and the following browser frame boundary is reached.
- Frame intervals are recorded from the visible co-op `requestAnimationFrame` loop. Hidden-page intervals are not admitted as normal visible frame samples.
- Rebirth intent to persisted/confirmed rebirth result remains the current Canon commit timing sample.
- Connection attempts and successful opens are captured, and selected ICE candidate pairs are classified when browser stats expose them. Unclassifiable TURN state remains unknown.

Host-loss/reopen, render-time freshness, same-world-time position error, rollback, GPU, memory and battery hooks remain unfilled until a runtime path can measure their stated semantics honestly.

## CLI

Generate an evidence template:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs template --class physical-multipeer
```

Build evidence from one aggregated raw sample object, or from a `captures` array containing separate Host/Guest capture JSON. Separate captures are merged without inventing fields that were not measured:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs build --input /tmp/rrp-raw-capture.json
```

A standalone physical validation before accepted calibration is expected to remain `calibration-required`, even when all measurements are present:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs validate --input /tmp/rrp-evidence.json --require-physical
```

Once a baseline has been reviewed and accepted, using it explicitly in `compare` supplies the calibration context and applies the regression ratchets to the current capture:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs compare --baseline accepted-baseline.json --current current.json
```

Focused checks:

```sh
node --test apps/rinne/tests/reality-performance-contract.test.mjs apps/rinne/tests/coop-performance.test.mjs apps/rinne/tests/coop-session.test.mjs apps/rinne/tests/rrp-performance-cli.test.mjs apps/rinne/tests/rrp-performance-capture.test.mjs
```

The existing co-op browser gate also checks that capture mode installs the diagnostic surface and that ordinary gameplay does not. The combined architecture proof still imports the contract proof. Reality Lab model results map into the same metric namespace but remain explicitly `model` evidence and are non-certifying.

## Next physical loop

The capture plumbing is now implemented. The remaining evidence work is narrower:

1. run repeatable 2–3 physical-peer captures on a fixed Wi-Fi profile and collect the first real input/ACK/display, frame, bandwidth, queue, ICE-path and Canon-commit distributions;
2. connect Host-loss/detection/reopen timestamps to the real browser migration path rather than the model;
3. measure render-time state freshness and same-world-time position error once prediction/interpolation is wired into the main Rinne co-op path;
4. join existing physical Performance Lab GPU/memory evidence by build/device/viewport provenance and add battery/radio measurements only where the platform exposes an honest boundary;
5. repeat on fixed WAN profiles with candidate-path classification where available;
6. gather enough samples, review the first compatible baseline, then promote selected calibrated values into absolute product SLO candidates;
7. expand from the initial 2–3 physical peers toward the separate 30-device certification matrix.

## Physical capture loop acceptance

This implementation loop is complete when the dedicated capture surface is present only in explicit capture mode, continuously samples the bounded probe, exports raw Host/Guest JSON accepted by the evidence builder, binds input-to-display to a post-render browser-frame boundary, and keeps missing physical measurements missing. It does not by itself certify WAN reachability, automatic Host migration, battery/radio behavior or 30-device scale.

No paid runtime or dedicated game server is required by this contract. NAT/TURN reachability, physical 30-device scale, battery and radio behavior remain unproved until their corresponding evidence exists.
