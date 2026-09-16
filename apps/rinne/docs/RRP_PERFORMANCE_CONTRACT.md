# RRP Performance Contract

This document is the performance contract for the Rinne communication architecture. Safety and correctness are hard gates; performance is evaluated as a vector rather than collapsed into a single flattering score.

## Evidence classes

Evidence is always labelled as one of these classes and may not be silently promoted:

1. `model` — deterministic Reality Lab / proof-model evidence. Useful for algorithmic comparisons, not a device claim.
2. `browser-synthetic` — real browser runtime on a synthetic/reference environment. Useful for regressions, not a physical-device claim.
3. `physical-device` — one physical device with explicit provenance. Useful for render/runtime budgets, not multi-peer WAN certification.
4. `physical-multipeer` — two or more physical peers with device/network/runtime provenance. Required for end-to-end multiplayer SLO certification.

## Hard safety gates

A result is invalid regardless of speed when any of the following is non-zero:

- committed canon rollback;
- duplicate irreversible commit;
- stale authority epoch accepted;
- split-brain OPEN overlap;
- irreversible state made visible before commit;
- recovery OPEN without the committed recovery material.

## Performance vector

The contract records at least:

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

Unknown or unsupported measurements remain `null`; they are never replaced by synthetic zeroes.

## Existing anchored SLOs

These values already exist elsewhere in the repository and are carried forward rather than reinvented here:

- Pixel-Fold-class physical frame target: frame p95 <= 33.34 ms (30 fps class), with the existing minimum sample contract.
- Host loss to migrating/darkness detection: <= 4500 ms.
- Migration start to reopened successor Host: <= 6000 ms.
- Current Rinne authority simulation cadence is 20 Hz and published results are approximately 10 Hz; these are workload facts, not proof that end-to-end latency is acceptable.

## New calibration policy

Metrics without an already justified absolute threshold are initially `calibration-required`. The first compatible `physical-multipeer` baseline records the observed distribution and becomes a ratchet baseline only after the metric has enough samples. A model value may suggest a candidate threshold but cannot certify a physical SLO.

After calibration, regressions are checked against both:

- an absolute SLO where one has been accepted; and
- a baseline-ratio ratchet, so an implementation cannot get materially worse while remaining under a loose absolute ceiling.

## Acceptance for this work

- implement a machine-readable contract and evaluator with explicit evidence class;
- retain the existing 4500/6000 ms migration and 33.34 ms mobile frame targets;
- make missing physical metrics visible as calibration gaps rather than passes;
- connect deterministic Reality Lab output to the same metric names used by later physical evidence;
- keep safety gates separate from Pareto/cost optimization;
- add regression tests proving that faster-but-unsafe results fail and model evidence cannot claim physical certification;
- do not add a paid runtime, dedicated game server, or weaken existing gates.
