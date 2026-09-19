# Development

Routine implementation is Astra-driven and optimized to avoid CI churn while preserving one final merge-owning validation.

## 1. Implement

- Confirm latest `develop` and `AGENTS.md`.
- Create or reuse a dedicated work branch / Draft PR from current `develop`.
- Use the connected GitHub Connector to read current source and construct the implementation on that branch.
- Prefer composing a coherent tree and moving the branch ref once when practical. Intermediate commits are allowed, but do not stop to wait for validation on superseded heads.
- Code Mode / V8 checks are preflight only.

## 2. Final reconcile, validate once, merge

When implementation is coherent:

1. Re-read current `develop`.
2. If `develop` advanced, reconcile it into the same work branch without discarding either compatible intent.
3. Verify the PR head now includes current `develop`.
4. While the PR is still Draft, edit its body to include exactly one line:
   ```text
   Astra-Validate: <current PR head SHA>
   ```
5. That body edit arms `Astra Work Validation` for that exact reconciled head. Wait only for this merge-owning run. Ignore cancelled, stale, or completed runs for earlier heads.
6. If the exact head passes and neither the PR head nor `develop` moved, mark Ready and merge immediately in the same task/session.
7. If the head or `develop` moved, reconcile first, replace the marker with the new head SHA, and run one new final-head validation. Do not re-run superseded heads.

Resolve real conflicts semantically. Never choose ours/theirs blindly and never weaken a quality gate.

Ready is not a handoff or success state. Normal success is `MERGED_TO_DEVELOP`.

## 3. DEV publication

The resulting `develop` push starts asynchronous DEV publication. Do not wait or poll for completion.

## Validation boundary

- Intermediate branch pushes are implementation details, not waiting points.
- Stale or cancelled validation runs must never be treated as task failure.
- Required merge evidence is one successful validation of the final reconciled head that will actually be merged.
- The `Astra Work Validation` runner is explicitly armed by the `Astra-Validate: <head SHA>` Draft-PR body marker.
- Explicit browser playtest requests still follow `BROWSER_PLAYTEST_ROUTING.md`; do not substitute static review for browser evidence.
- `main` / Production retains its existing strict gates.

## PR contract

A PR body starts with two plain lines:

```text
short task title
short description of what changes
```

Then include only useful scope, dependency, assumption, DEV-review notes, and the temporary `Astra-Validate: <head SHA>` marker when final validation is armed.

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
