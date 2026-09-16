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
- `inputToDisplayMs`: local input creation to the first rendered frame that actually presents an authoritative state containing that applied input. Network receipt alone does not end the timer, and a prediction-only frame does not end it either.
- `canonCommitMs`: irreversible intent creation to the committed Canon revision becoming visible to the initiator. Pre-commit animation does not end the timer.
- `hostLossDetectionMs`: injected/observed old-Host loss to the first `MIGRATING`/darkness transition.
- `hostReopenMs`: migration start to the successor becoming `OPEN` with the committed recovery material.
- `peerUplinkKbps` / `hostUplinkKbps`: application payload bytes in fixed one-second buckets, including idle zero-byte buckets inside the measured interval. WebRTC stats may corroborate them when available.
- `reliableBufferedAmountBytes` / `presenceBufferedAmountBytes`: sample `RTCDataChannel.bufferedAmount`. This is the user-agent send queue only; it does not include OS/network hardware buffering.
- `stateFreshnessMs`: render-apply time minus the timestamp/tick time of the newest authoritative state used by that render.
- `positionErrorM`: displayed interpolated/reconciled position versus the authoritative position for the same world time. Do not compare values at different ticks.
- `rollbackMs`: amount of already presented reversible world time invalidated by one correction. If a measured interval has zero rollbacks, rate/p95/max are measured zero, not unknown.
- `connectionSuccessRate`: successful DataChannel opens divided by connection attempts using the same timeout and network profile.
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
- 120 one-second peer-uplink and Host-uplink buckets;
- 120 samples for each DataChannel buffer maximum source;
- 300 freshness samples and 300 position-error samples;
- a measured rollback interval; zero rollback is valid evidence for that interval;
- 20 connection attempts;
- 300 frame samples.

These are minimum evidence floors for this development contract, not a claim of statistical confidence or an industry standard. Captures below a floor are `calibration-required`, never a pass.

After a baseline is explicitly accepted, regression checking uses both an existing absolute SLO where one exists and a baseline ratchet. The default regression guard permits at most roughly 12% degradation for core latency/frame metrics, 15% for bandwidth/error/resource metrics and 20% for DataChannel queue peaks. `connectionSuccessRate` is handled separately as higher-is-better and may not fall below 98% of its accepted baseline. These ratios are regression guards, not product SLOs.

## Runtime capture now wired

The current co-op runtime can take an **opt-in** bounded performance probe. Normal gameplay does not create the probe, run `getStats()`, UTF-8-count every outgoing message, or retain sample arrays merely because this measurement code exists.

When a probe is supplied, it records:

- Guest input creation and the exact authoritative input sequence applied by the Host. The Host publishes `ackInputSeq` only after the 20 Hz authoritative advance, not merely after packet receipt. This fills `inputToAuthoritativeAckMs`.
- Rebirth intent to persisted/confirmed rebirth result on the Guest.
- Application payload bytes in fixed one-second buckets and reliable/presence `bufferedAmount` samples from the existing room wire, including queue pressure on replaceable drops.
- Connection attempts and successful opens. When `getStats()` exposes a selected candidate pair, relay/direct classification is recorded; unsupported candidate classification stays unknown.
- A bounded raw-sample snapshot through `session.performance()` while the probe is attached.

The probe exposes a separate `recordInputToDisplay` hook so network acknowledgement cannot be mislabeled as rendered latency. It also exposes hooks for Host-loss/reopen, state freshness, same-time position error, rollback, frame/GPU, memory and battery measurements. These fields remain unknown until the corresponding runtime/render layer can measure the stated boundary honestly.

## CLI

Generate an evidence template:

```sh
node apps/rinne/scripts/rrp-performance-contract.mjs template --class physical-multipeer
```

Build evidence from one aggregated raw sample object, or from a `captures` array containing separate Host/Guest probe snapshots. Separate captures are merged without inventing fields that were not measured:

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
node --test apps/rinne/tests/reality-performance-contract.test.mjs apps/rinne/tests/coop-performance.test.mjs apps/rinne/tests/rrp-performance-cli.test.mjs
```

The combined architecture proof also imports the contract proof. Reality Lab model results are mapped into the same metric namespace but remain explicitly `model` evidence and are expected to be non-certifying.

## Next physical loop

The remaining evidence work is now narrower:

1. wire a dedicated browser/performance capture route that explicitly creates the probe without enabling it in ordinary gameplay;
2. wire the render layer to `recordInputToDisplay` after the authoritative state is actually presented, rather than treating network receipt as display;
3. connect Host-loss/detection/reopen timestamps to the real browser migration path rather than the model;
4. measure render-time state freshness and same-world-time position error once prediction/interpolation is wired into the main Rinne co-op path;
5. join existing physical Performance Lab frame/GPU evidence by build/device/viewport provenance;
6. run repeatable physical-multipeer captures across fixed Wi-Fi and WAN profiles, with candidate-path classification where available;
7. gather enough samples, review the first compatible baseline, then promote selected calibrated values into absolute product SLO candidates;
8. expand from the initial 2–3 physical peers toward the separate 30-device certification matrix.

No paid runtime or dedicated game server is required by this contract. NAT/TURN reachability, physical 30-device scale, battery and radio behavior remain unproved until their corresponding evidence exists.
