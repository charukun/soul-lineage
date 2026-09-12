# PULSE / Integration throughput repair

## Scope

Repair the develop-side delivery control plane without changing `main` or Production.

The implementation must preserve every existing CI, review, dependency, mergeability, browser-verification and exact-head safety gate while reducing redundant GitHub API work and removing unrelated serialization between Integration and the slower DEV publication/browser phase.

## Acceptance criteria

- Measure the current PULSE, WAYFINDER and `Deploy DEV and PROD` behavior from repository code and Actions runs before changing behavior.
- Do not claim a GitHub primary/secondary rate-limit incident unless run evidence shows one.
- GitHub API requests used by Integration have an explicit timeout, bounded retry/backoff for transient throttling/server failures, and run-local diagnostics.
- Pagination is bounded per request family and fails closed when the bound is exceeded.
- Repeated reads that are safe to reuse inside one evaluation phase are cached; final mutable safety checks remain fresh immediately before merge.
- One Integration run has a bounded evaluation/time budget and safely leaves deferred Ready PRs for a later run.
- Pages publication remains serialized, while Integration is not blocked behind focused DEV browser verification or unrelated repair-ticket work.
- PULSE must not describe the whole delivery workflow as `Integration中` after the Integration job has already moved into publication/browser verification.
- Explicit Integration holds must not be reported as stale merge-ready work.
- Integration diagnostics include request count, cache hits, retries/throttle evidence, last heartbeat/phase and major elapsed timings, and are retained as an Actions artifact.
- Add fast regression coverage for the failure mode.

Depends-On: none
