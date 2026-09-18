# Semantic Kernel final practical validation

This task turns the already-converged protected semantic split into an executable, comparable measurement path. It does not introduce a new consensus mechanism.

## Runtime boundary

The gameplay authority remains the existing `coop-v2` store. Semantic shadow, recovery overlay, and the A/B/C measurement stores are non-authoritative diagnostics. Their failure must not turn a successful `coop-v2` save into gameplay failure.

The protected surface under test remains:

- player birth;
- life seal, including an early combat-ended life;
- rebirth from a sealed predecessor;
- authority epoch acquisition.

Movement, position, transient HP/stamina and presentation remain provisional. Equipment, experiences, skills, defeats and homelands become protected through the terminal lineage input at life seal.

## What the capture measures

`?rrpCapture=1` installs a DEV measurement panel and raw JSON exporter. A capture can include:

- whole checkpoint bytes;
- semantic journal bytes;
- protected event count;
- input to authoritative ACK;
- input to displayed authoritative state;
- protected durable commit latency;
- host and peer uplink;
- reliable and presence queue pressure;
- authoritative state freshness;
- observed rollback amount;
- frame time;
- host-loss detection and reopen;
- connection success and selected TURN relay classification;
- memory only when the browser exposes a trustworthy JS heap reading;
- GPU only when a real GPU timing source has populated the existing probe.

Battery is not synthesized. If no trustworthy source supplied battery samples, it stays absent.

## Matched persistence variants

The query parameter `rrpVariant` selects one DEV-only diagnostic write path. All use the exact payload produced by the live runtime, the same browser/localStorage mechanism, JSON UTF-8 encoding and no compression.

- `all-state-strong`: writes the whole checkpoint on each observed save. Protected-boundary writes are also marked separately.
- `semantic-journal`: writes only protected semantic events strongly and writes a provisional checkpoint at the configured RPO.
- `fair-known-event-sourcing`: intentionally uses the same protected event encoding and the same write/RPO path as `semantic-journal`. It is the fair known baseline, not a deliberately weaker comparator.

`rrpRpo` is the provisional checkpoint interval in seconds and defaults to 2. The semantic and known-baseline runs must use the same value.

The variant stores are isolated under measurement-only localStorage keys. Write errors are captured in raw JSON and fail the comparison, but they never change gameplay authority.

## Deterministic protected workload

The capture panel exposes `seal→rebirthを実行` only while RRP capture mode is active on the Host. It calls the same `endLifeEarly()` domain boundary used by early life termination, durably seals that life through the normal Host save, then uses the normal rebirth path. It does not alter combat death probability and is not available during ordinary play.

The guest birth that occurs before the requested peer cohort is fully connected is buffered by the capture controller and replayed into the measurement window after it arms, so the protected birth is not silently omitted.

Host leave/resume uses the normal co-op flow. The capture preserves pre-loss samples across that interruption, records Host-loss/reopen evidence, and the restored semantic shadow must remain anchored rather than silently claiming continuous coverage.

## Physical capture procedure

Use the same DEV build on endpoint A and endpoint B. Endpoint A is the Host. Endpoint B is the peer. For each of the three variants below, start from a fresh co-op village and append this query to the DEV URL on both endpoints:

`?rrpCapture=1&rrpPeers=2&rrpWorkload=semantic-final-v1&rrpVariant=<variant>&rrpRpo=2`

Run these variants separately:

1. `all-state-strong`
2. `semantic-journal`
3. `fair-known-event-sourcing`

For every run:

1. A opens a village and sends the invite to B. B joins and A accepts the answer.
2. Wait until both capture panels show 2/2 connected.
3. On B, move normally for at least 30 seconds. Include an idle interval as well.
4. On A, tap `seal→rebirthを実行` once.
5. Continue ordinary movement for at least 30 seconds.
6. On A, use the normal `接続をやめる / 村を離れる`, then `前の村を開く`. Create a fresh invite.
7. On B, leave the closed session and join the reopened village with the new invite. A accepts it.
8. After 2/2 is restored, continue movement/idle long enough to capture the post-reopen window.
9. On both endpoints tap `raw JSONを保存`.

Do not edit or summarize the JSON files. Upload the six saved files as-is.

The scripted seal is for deterministic persistence comparison. The repository's focused runtime checks separately cover that an actual combat-ended life can seal before 100 years and rebirth from the committed predecessor.

## Automatic comparison

Run all Host/peer files through:

`node apps/rinne/scripts/semantic-kernel-final-compare.mjs <capture.json> [...]`

The analyzer fails closed when:

- one A/B/C variant is missing;
- endpoint cohort, build, workload, peer target or RPO provenance does not match;
- the protected event sequence/count differs across variants;
- bandwidth sampling contains unobserved buckets;
- semantic shadow/persistence diverges;
- a diagnostic variant write fails;
- a required runtime measurement is absent.

It reports separately:

- setup/bootstrap bytes;
- all commit bytes;
- protected commit bytes and p95 write latency;
- provisional checkpoint bytes and p95 write latency;
- total persistence bytes;
- live runtime latency/bandwidth/queue/freshness/rollback/frame/recovery metrics;
- optional GPU/memory/battery availability.

The analyzer's `physicalComplete` flag means the requested single-run physical measurement is structurally complete. It is not a claim of population-level statistical confidence and does not bypass the repository's existing physical sample-floor/certification rules.

## Decision rule

If physical evidence shows that the semantic split materially reduces the persistence burden versus the all-state path without a protected-commit regression beyond the repository's existing canon-latency ratchet, and the known event-sourcing baseline remains equivalent or better, the implementation conclusion is Semantic Kernel separation plus the known event-sourcing mechanism.

If the fair known baseline is better, use it. If the measured difference is small or unstable, report that without inventing an RRP advantage.

Until physical captures exist, the final architecture decision remains pending physical evidence even when local/focused correctness checks pass.

Depends-On: none
