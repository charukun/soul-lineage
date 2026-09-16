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

- input-to-authoritative-display p50/p95/p99;
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

- `inputToDisplayMs`: local input creation time to the first authoritative state that acknowledges that input being applied to the visible render state. A prediction-only frame does not end the timer.
- `canonCommitMs`: irreversible intent creation to the committed Canon revision becoming visible to the initiator. Pre-commit animation does not end the timer.
- `hostLossDetectionMs`: injected/observed old-Host loss to the first `MIGRATING`/darkness transition.
- `hostReopenMs`: migration start to the successor becoming `OPEN` with the committed recovery material.
- `peerUplinkKbps` / `hostUplinkKbps`: payload bytes over fixed one-second windows. Record application payload counters; WebRTC stats may corroborate them when available.
- `reliableBufferedAmountBytes` / `presenceBufferedAmountBytes`: sample `RTCDataChannel.bufferedAmount`. This is the user-agent send queue only; it does not include OS/network hardware buffering.
- `stateFreshnessMs`: render-apply time minus the timestamp/tick time of the newest authoritative state used by that render.
- `positionErrorM`: displayed interpolated/reconciled position versus the authoritative position for the same world time. Do not compare values at different ticks.
- `rollbackMs`: amount of already presented reversible world time invalidated by one correction. If a sufficiently long measurement interval has zero rollbacks, rate/p95/max are measured zero, not unknown.
- `connectionSuccessRate`: successful DataChannel opens divided by connection attempts using the same timeout and network profile.
- `turnRelayRate`: selected relay candidate-pair connections divided by connected peers. Leave `null` when selected candidate type cannot be established.

`RTCPeerConnection.getStats()` is suitable for connection statistics where the browser exposes the needed dictionaries. Data-channel-specific stats are not uniformly available, so application send counters remain the portable payload source. `RTCDataChannel.bufferedAmount` is sampled directly for queue pressure.

## Existing anchored SLOs

These values already exist elsewhere in the repository and are carried forward rather than reinvented here:

- Pixel-Fold-class physical frame target: frame p95 <= 33.34 ms (30 fps class), with the existing minimum sample contract.
- Host loss to migrating/darkness detection: <= 4500 ms.
- Migration start to reopened successor Host: <= 6000 ms.
- Current Rinne authority simulation cadence is 20 Hz and published results are approximately 10 Hz; these are workload facts, not proof that end-to-end latency is acceptable.

## Calibration floors

For metrics that did not previously have an accepted product SLO, the first compatible physical-multipeer baseline establishes the observed value. Before certification, the capture must at least contain:

- 300 input-to-display samples;
- 20 Canon commits;
- 20 Host-loss and 20 successor-reopen observations;
- 120 one-second peer-uplink and Host-uplink windows;
- 120 samples for each DataChannel buffer maximum source;
- 300 freshness samples and 300 position-error samples;
- a measured rollback interval; if rollbacks occur, the p95 uses the captured rollback events;
- 20 connection attempts;
- 300 frame samples.

These are minimum evidence floors for this development contract, not a claim of statistical confidence or an industry standard. Captures below a floor are `calibration-required`, never a pass.

After calibration, regression checking uses both an accepted absolute SLO where one exists and a baseline ratchet. The default regression guard permits at most roughly 12% degradation for core latency/frame metrics, 15% for bandwidth/error/resource metrics and 20% for DataChannel queue peaks. These ratios are regression guards, not product SLOs.

## CLI

Generate a schema template:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs template --class physical-multipeer
```

Aggregate a raw capture into evidence:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs build --input /tmp/rrp-raw-capture.json
```

Validate evidence, optionally requiring complete physical certification:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs validate --input /tmp/rrp-evidence.json --require-physical
```

Compare a compatible baseline/current pair using the regression ratchet:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs compare --baseline baseline.json --current current.json
```

Focused contract tests:

```sh
node --test apps/rinne/tests/reality-performance-contract.test.mjs
```

The combined architecture proof also imports the contract proof. Reality Lab model results are mapped into the same metric namespace but remain explicitly `model` evidence and are expected to be non-certifying.

## Next physical loop

The next evidence layer should instrument the current Rinne co-op path rather than fabricate physical values in Reality Lab:

1. stamp input sequence creation and authoritative acknowledgement/application;
2. stamp irreversible intent and committed Canon visibility;
3. sample application payload bytes and both DataChannel `bufferedAmount` values;
4. sample selected ICE candidate information and connection success where supported;
5. capture Host failure/detection/reopen timestamps;
6. join existing physical Performance Lab frame/GPU evidence by build/device/viewport provenance;
7. produce `physical-multipeer` evidence and calibrate the currently threshold-less metrics;
8. only then turn calibrated values into absolute product SLO candidates.

No paid runtime or dedicated game server is required by this contract. NAT/TURN reachability, physical 30-device scale, battery and radio behavior remain unproved until their corresponding evidence exists.
