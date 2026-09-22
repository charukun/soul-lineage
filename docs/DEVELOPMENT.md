# Development

Routine implementation is Astra-driven and uses connector-native exact-source proof so the normal critical path has no CI runner startup.

## 1. Implement

- Confirm latest `develop` and `AGENTS.md`.
- Use the connected GitHub Connector to read current source and compose the final tree against the current `develop` tree without creating a routine branch yet.
- For routine Fast DEV, validate the final bytes, create blobs/tree, create the final commit with `develop` as parent, then create a short-lived `routine/txn-*` branch directly at that commit. This replaces `create branch -> commit -> update ref` with `commit -> create branch`.
- Open the routine PR non-draft only after the final branch head exists. Treat the `routine/txn-*` ref as transport-only; do not reuse it for another PR. Draft PRs and intermediate branch moves are reserved for recovery or heavy/specialist work that genuinely needs multiple published heads.
- Validate the final source bytes before GitHub blob creation. For routine JS checks, run syntax/consistency validation against the exact final byte strings that will be sent to `create_blob`; those returned blob SHAs become the proof coordinates.
- Routine Fast DEV does not perform staging/browser/Playwright/render/DCC/evidence observation automatically. Player-facing scope alone is not a trigger. Run those paths only for an explicit user request or an existing specialist/autonomous route that explicitly requires them.

## 2. Validate once, then check impact-aware freshness

When implementation is coherent:

1. Re-read current `develop`, but do not reconcile solely because its SHA advanced.
2. Routine Fast DEV accepts only `Astra-Validation: none` or targeted `Astra-Check`. Validate each declared source against the exact final bytes before blob creation.
3. Create the GitHub blobs from those same checked bytes, create the final tree, then create the final commit **before** creating the routine branch. The returned blob SHAs and final commit SHA are the immutable exact-source proof.
4. Create the dedicated branch directly at that final commit and open the PR non-draft. The create-PR response is the head-identity receipt; do not re-read PR info on the unchanged-base path.
5. Re-read current `develop` exactly once immediately before merge. If it still equals the final commit parent, merge immediately with `expected_head_sha`. Do not separately query mergeability; the merge API is authoritative and fails closed.
6. Only if `develop` advanced, compare the drift with the work delta by affected app/package/build/control-plane scope. Independent mergeable drift reuses the proof; conflict or overlap requires reconciliation into the same branch and a new proof.
7. Fetch the resulting merge commit once and confirm the validated head is a parent. The develop push starts DEV publication asynchronously. A non-blocking post-merge cleanup job deletes the merged `routine/txn-*` head ref; do not poll or wait for it.

Heavy/specialist work is different: add `[astra-heavy-validation]` and use the hosted exact-head runner for tests, builds, browser/DCC/asset work, or any validation requiring a real repository execution environment.

Resolve real conflicts semantically. Never choose ours/theirs blindly and never weaken a quality gate.

Ready is not a handoff or success state. Normal success is `MERGED_TO_DEVELOP`.

## 3. DEV publication

The resulting `develop` push starts asynchronous DEV publication. Do not wait or poll for completion.

Per-app DEV publication is impact-scoped. Known non-build documentation/control files such as `AGENTS.md` and ordinary `docs/**` changes must not rebuild unrelated apps. Changes to the DEV publication planner itself are control-plane-only and must not publish application artifacts. Unknown root/configuration changes remain fail-closed so potentially build-affecting changes cannot be silently skipped.

## Fast DEV execution contract

Fast DEV is intentionally bounded. Routine feature/fix work must not make GitHub Actions do more work than the current `develop` contract.

Routine Fast DEV does not invoke validation Actions. A tiny post-merge cleanup job is allowed only for deleting merged `routine/txn-*` transport refs and is outside the critical path. The authoring lane must fail closed before commit if ordinary work changes the workflow, focused runner, contract, freshness classifier, or build lifecycle. Explicit contract changes are heavy validation. Routine plans are `none` or syntax-check only; dependency installation is heavy-only.

A routine contract violation is caught before the final Git Data write and repaired on the same branch / PR. Only an explicit user request to change the Fast DEV contract itself can authorize a contract-changing task. Such a commit includes `[astra-contract-change]` and `[astra-heavy-validation]`; the hosted runner verifies the contraction before merge.

## Validation boundary

- Intermediate branch pushes are implementation details, not waiting points.
- Stale or cancelled validation runs must never be treated as task failure.
- Routine merge evidence is the exact-bytes blob/tree/commit proof plus connector-native PR-head, mergeability, and freshness verification. There is no routine Actions status.
- Heavy/specialist merge evidence is one successful hosted execution for the exact PR head. Actions inspection remains status-first for that lane.
- The default DEV gate does not run repository-wide syntax, code-health, visual-budget, production-asset, or all-consumer build sweeps. Those are Astra-selected only when materially relevant.
- Routine Fast DEV validation is intentionally non-behavioral: `none` or targeted source syntax checks only. Do not pre-detect whether the app starts, gameplay/animation feels wrong, UI looks wrong, or runtime behavior regressed. The user may detect those on DEV and request the next fix. Tests/builds/browser/runtime/visual validation require an explicit heavy/specialist request. Check-only and none plans skip dependency installation.
- Do not create task-scoped browser/evidence runners as routine authoring feedback. Browser, staging, render, DCC, screenshot, and similar observation stay outside the normal Fast DEV critical path unless explicitly requested or required by the selected specialist/autonomous route.
- The `Astra Work Validation` runner is explicitly armed only when the pushed final-head commit message contains both `[astra-validate]` and `[astra-heavy-validation]`.
- Explicit browser playtest requests still follow `BROWSER_PLAYTEST_ROUTING.md`; do not substitute static review for browser evidence.
- `main` / Production retains its existing strict gates.

## PR contract

A PR body starts with two plain lines:

```text
short task title
short description of what changes
```

The PR title and those first two lines are also the human-facing source for DEV notifications. When the task was requested in Japanese, write them in concise Japanese and describe the visible change rather than using implementation-only English wording. The first line should say what changed; the second should say what the user can now expect.

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

Never modify `main` / Production without explicit permission. Routine DEV may intentionally omit behavioral/runtime/visual validation; do not weaken the final-head contract/freshness merge gate, explicitly requested specialist/autonomous checks, or Production gates.
