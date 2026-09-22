# Integration notification freshness

## Scope

Integration Rescue notifications must describe the current GitHub PR/head at send time, not merely a historical Rescue outbox snapshot.

## Acceptance

- Before any PR-specific `FAILED` / `AI_REPAIR_REQUIRED` notification is delivered, re-read the live PR.
- If the PR is closed, Draft, no longer targets `develop`, moved outside this repository, or its current head differs from the outbox/Rescue head, suppress the stale external failure notification.
- Suppressed stale entries are finalized as superseded instead of retried, so an obsolete failure cannot arrive minutes later after a repaired/new head has already taken over.
- Current-head notifications keep the existing finite retry/backoff and GitHub repair-signal behavior.
- `READY_FOR_INTEGRATION` wave summaries omit members whose returned head is no longer current instead of presenting them as current results.
- No review, exact-head CI/browser, Integration, Rescue attempt, main, or Production gate is weakened.
