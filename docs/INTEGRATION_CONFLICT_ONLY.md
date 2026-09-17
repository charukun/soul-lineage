# Integration Conflict-Only Repair

Integration conflict repair has one responsibility: reconcile the current source PR branch with the latest `develop` without changing either side's compatible intent.

## Completion boundary

A conflict-only repair is complete when all of the following are true:

1. latest `develop` was resolved immediately before repair;
2. the existing source PR branch was merge-forwarded without force push or history rewrite;
3. semantic conflicts, if any, were resolved without blind ours/theirs selection, assertion deletion, or gate weakening;
4. the resulting source PR is no longer `dirty` / conflicting against `develop`;
5. the repaired head is pushed and returned to Integration.

At that point the conflict-repair worker stops. It does **not** repair failures discovered by PR Checks, DEV validation/build, browser verification, control-plane validation, dependency installation, or unrelated repository gates.

## CI repair is separate

A CI/build/check failure after a conflict-only repair is a separate `CI_REPAIR` incident. It must not reopen, extend, or consume attempts from the completed `CONFLICT_REPAIR` incident unless the failure itself proves that the conflict resolution was structurally invalid (for example unresolved conflict markers or a merge-created syntax error in a resolved hunk).

Existing quality gates remain unchanged. This separation changes ownership and stopping conditions only; it does not turn a failing check green, bypass required status, delete tests, or weaken Production gates.

## Fast Repair

For mechanically safe non-overlapping merge-forward, Fast Repair may update the PR branch and immediately return it to Fast Lane. Conflict-only mode must not run `npm ci`, `scripts/validate.mjs dev`, application tests, browser tests, or builds as part of deciding whether the merge-forward itself succeeded.

Normal Integration may still enforce whatever exact-head evidence is independently required before merging. A failure there is classified and handed off as `CI_REPAIR`, not recursively treated as conflict repair.
