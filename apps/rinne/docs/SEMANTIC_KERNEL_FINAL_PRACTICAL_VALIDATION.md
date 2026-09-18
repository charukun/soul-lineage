# Semantic Kernel final practical validation

This task turns the already-converged protected semantic split into an executable, comparable measurement path on current `develop`. It does not introduce a new consensus mechanism.

## Acceptance

- Keep current authoritative `coop-v2` behavior safe while validating the protected surface.
- Reuse only still-valid #853 semantic-shadow/runtime intent on top of current `develop`.
- Cover birth, early combat death, life seal, rebirth, epoch, history ordering, restart restore and recovery overlay with focused executable tests.
- Capture raw device/browser measurements for checkpoint bytes, semantic journal bytes, protected event count, input-to-authoritative-ACK, input-to-display, protected commit latency, uplink, reliable/presence queues, freshness, rollback, frame p95, host-loss/reopen/connection/TURN; include GPU/memory only where trustworthy and do not fabricate battery.
- Compare the same scripted workload under:
  - whole-checkpoint / all-state-oriented handling;
  - semantic journal + provisional recovery checkpoint;
  - known event-sourcing baseline with the same semantic split, encoding, batching/compression, topology, transport, provisional RPO and trust/failure model.
- Export raw JSON and compute an automatic comparison/pass-fail report.
- Do not treat synthetic/browser/local evidence as physical-device evidence.

## Decision rule

If semantic separation clearly improves on whole-checkpoint handling but matches a fair known event-sourcing baseline, adopt the semantic split with the known mechanism. If the fair baseline is better, adopt it. If the difference is practically small, report that directly.

Depends-On: none
