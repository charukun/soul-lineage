# Development

Routine implementation is Astra-driven and optimized to avoid CI churn while preserving one final merge-owning validation.

## 1. Implement

- Confirm latest `develop` and `AGENTS.md`.
- Create or reuse a dedicated work branch / Draft PR from current `develop`.
- Use the connected GitHub Connector to read current source and construct the implementation on that branch.
- Prefer composing a coherent tree and moving the branch ref once when practical. Intermediate commits are allowed, but do not stop to wait for validation on superseded heads.
- Code Mode / V8 checks are preflight only.

## 2. Validate once, then check impact-aware freshness

When implementation is coherent:

1. Re-read current `develop`, but do not reconcile solely because its SHA advanced.
2. Make the final work-head commit include `[astra-validate]`. This arms `Astra Work Validation` for that exact pushed head.
3. The runner validates only the work delta from its merge-base, not unrelated develop drift.
4. After validation, the freshness gate re-reads current `develop`.
5. If current `develop` is already contained in the work head, proceed normally.
6. Otherwise require a clean Git merge and compare the work delta with the new develop delta using affected apps/packages plus shared build/dependency/control-plane scope.
7. If the deltas are independent, keep the existing exact-head validation and merge without retesting.
8. If the merge conflicts or affected scope overlaps, reconcile into the same branch, create a new `[astra-validate]` head, and validate once more.
9. After freshness succeeds, mark Ready and merge immediately in the same task/session.

Resolve real conflicts semantically. Never choose ours/theirs blindly and never weaken a quality gate.

Ready is not a handoff or success state. Normal success is `MERGED_TO_DEVELOP`.

## 3. DEV publication

The resulting `develop` push starts asynchronous DEV publication. Do not wait or poll for completion.

## Fast DEV execution contract

Fast DEV is intentionally bounded. Routine feature/fix work must not make GitHub Actions do more work than the current `develop` contract.

Before install scripts, changed focused tests, or affected builds, `Astra Work Validation` runs the Fast DEV contract checker sourced from current `develop`. It rejects branch-authored expansion of the Actions workflow/control path, Fast DEV lifecycle commands, or the repository test inventory. `npm ci --ignore-scripts` prevents branch lifecycle hooks from running during dependency installation.

A violation publishes `astra/fast-dev-contract=error` with a machine-readable receipt and skips the remaining validation work. This is deliberately recoverable and is not a GitHub branch-protection dead end: the same worker repairs the same branch / PR, makes a new final head, and re-validates. Only an explicit user request to change the Fast DEV contract itself can authorize merging a contract-changing task. For an explicit workflow reduction, the final commit also includes `[astra-contract-change]`; the runner then verifies that the Actions surface only contracts to the canonical allowlist and does not add workflows or tests.

## Validation boundary

- Intermediate branch pushes are implementation details, not waiting points.
- Stale or cancelled validation runs must never be treated as task failure.
- Required merge evidence is one successful validation of the exact PR head, with `astra/fast-dev-contract=success` and `astra/merge-freshness=success`. Independent mergeable develop drift does not invalidate that evidence.
- The `Astra Work Validation` runner is explicitly armed only when the pushed final-head commit message contains `[astra-validate]`.
- Explicit browser playtest requests still follow `BROWSER_PLAYTEST_ROUTING.md`; do not substitute static review for browser evidence.
- `main` / Production retains its existing strict gates.

## PR contract

A PR body starts with two plain lines:

```text
short task title
short description of what changes
```

Then include only useful scope, dependency, assumption, and DEV-review notes. Validation arming belongs to the final commit message, not the PR body.

Normal terminal states are:

- `MERGED_TO_DEVELOP`
- `FAILED` only when a real blocker remains

## User-facing completion

Keep the normal completion report short:

- what changed
- merged to `develop`
- PR link when useful

Do not print validated-head SHA, validation-run URL, merge SHA, or CI internals unless the user asks for them or a blocker requires evidence.

## Recovery

If a session stops, resume from the current branch / PR / head. Do not rebuild state from old chat history.

A failed local git command, DNS path, `git push`, Codespaces route, cancelled stale workflow, or single tool is not itself a blocker. Keep the same branch / PR and continue through the connected GitHub Connector plus repository workflow path.

Do not create a replacement PR merely because one transport or superseded validation run failed.

Never modify `main` / Production without explicit permission. Never weaken tests, browser assertions, review requirements, the final-head merge gate, or Production gates.
