# Development

Routine implementation is Astra-driven and has three stages.

## 1. Implement

- Confirm latest `develop` and `AGENTS.md`.
- Create or reuse a dedicated work branch / PR from current `develop`.
- Normal work uses a Draft PR; a qualifying Micro Patch follows `MICRO_PATCH_FAST_LANE.md`.
- Use the connected GitHub Connector to read the current source and construct the implementation commit on that same work branch with Contents / Git Data operations.
- Run affected focused test/check/build against that exact head in the `Astra Work Validation` GitHub Actions hosted checkout. Code Mode / V8 checks may be used as preflight, but are not formal validation evidence.

## 2. Sync and merge

Before Ready:

1. Re-read current `develop`.
2. If `develop` advanced, reconcile it into the same work branch without discarding either compatible intent.
3. Run affected focused validation again on the reconciled exact head in a real repository checkout.
4. Verify the PR head still equals the validated exact head and that current `develop` is included.
5. Verify freshness, mark Ready, then merge that exact validated head to `develop` in the same task/session.

Resolve real conflicts semantically. Never choose ours/theirs blindly and never weaken a quality gate.

If current `develop` or the PR head advances after validation, repeat reconcile -> focused validation -> freshness verification instead of merging stale work.

Ready is not a handoff or success state. Normal success is `MERGED_TO_DEVELOP`.

## 3. DEV publication

The resulting `develop` push starts asynchronous DEV publication. Do not wait or poll for completion.

## Validation boundary

- Connector commit construction and Code Mode checks do not by themselves satisfy focused validation.
- Required focused validation must be recorded for the exact head that will be merged.
- The `Astra Work Validation` GitHub Actions hosted runner is the normal validation workspace for Chat sessions without a usable local repository checkout.
- Explicit browser playtest requests follow `BROWSER_PLAYTEST_ROUTING.md`; do not substitute static review for browser evidence.

## PR contract

A PR body starts with two plain lines:

```text
short task title
short description of what changes
```

Then include only useful scope, validation, dependency, assumption, and DEV-review notes.

Normal terminal states are:

- `MERGED_TO_DEVELOP`
- `FAILED` with repository / branch / exact head / PR / concrete blocker

## Recovery

If a session stops, resume from the current branch / PR / exact head. Do not rebuild state from old chat history.

A failed local git command, DNS path, `git push`, Codespaces route, or single tool is not itself a blocker. Keep the same branch / PR and continue through the connected GitHub Connector plus repository workflow / evidence path.

Do not create a replacement PR merely because one transport failed.

Never modify `main` / Production without explicit permission. Never weaken tests, browser assertions, review requirements, exact-head checks, or Production gates.
