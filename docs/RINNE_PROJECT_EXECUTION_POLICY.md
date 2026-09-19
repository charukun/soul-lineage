# Implementation execution policy

## Source of truth and completion

The source of truth is latest `develop` plus current GitHub branch / commit / PR / status.

Routine implementation finishes only after the same task worker merges the final reconciled PR head to `develop`.

```text
implementation on Draft PR
  -> current develop reconciliation
  -> final reconciled commit carries [astra-validate]
  -> one exact-head focused validation in a real checkout
  -> freshness verification
  -> Ready + same-task merge
  -> asynchronous DEV publication
```

Ready is not success. DEV publication is not a merge prerequisite.

## Canonical Chat execution path

For Chat sessions, the canonical implementation path is:

1. Read latest `develop` and current repository state through the connected GitHub Connector.
2. Create or reuse one dedicated work branch / Draft PR.
3. Construct implementation changes through GitHub Contents / Git Data operations. Prefer a coherent final tree/ref update instead of pushing every tiny intermediate edit.
4. Do not wait for validation on intermediate heads. Skipped, cancelled, or stale runs from superseded heads are not task failure.
5. When implementation is coherent, re-read latest `develop`; if it advanced, reconcile it into the same branch.
6. Make the final reconciled head a commit whose message contains `[astra-validate]`. That exact push owns the single required merge validation.
7. When that exact head passes, verify freshness, mark Ready, and merge immediately to `develop` in the same task/session.
8. Let the resulting `develop` push start asynchronous DEV publication.

A local clone, direct `github.com` DNS, local `git push`, and Codespaces are not prerequisites for this path.

## Validation boundary

Code Mode / V8 syntax checks, manifest checks, source inspection, and other in-Chat checks are useful preflight evidence, but they are not a substitute for the one required focused test/check/build on the final reconciled repository head.

The merge candidate must exactly match the final reconciled head that passed required focused validation. If the PR head or `develop` moves afterward, reconcile first and make the new reconciled head another `[astra-validate]` commit. Do not chase or retry superseded runs.

Do not use Connector writes to bypass tests, review, browser assertions, freshness, final-head verification, or Production protections.

## Waiting discipline

Do not use watch/sleep loops for ordinary CI, browser verification, or DEV publication.

Intermediate branch pushes are never waiting points. Only the single merge-owning final-head validation may block Ready / merge. Check that task-owned run as needed to complete the task, but ignore unrelated workflows.

A one-time immediate check for an obvious launch/configuration failure is fine.

## Autonomous decisions

Within confirmed requirements, Astra chooses reversible implementation details, UI details, wording, and technical approach. Do not add a human approval step merely because visual review may happen later on DEV.

Ask for human input only when the task truly requires an irreversible/compatibility-breaking decision, user authentication, new paid resources, or another decision not derivable from current requirements.

## Failure and recovery

One failed tool, transport, command, local capability, DNS path, `git push`, cancelled stale workflow, or Codespaces route is not task failure.

Preserve the same branch / PR and continue through the connected GitHub Connector plus existing repository workflow / evidence routes. Do not create a replacement PR merely because one transport or superseded run failed.

Report `FAILED` only when a concrete blocker remains after applicable Connector and repository workflow routes are exhausted.

## Evidence and final report

Do not claim browser, image, motion, test, or build verification unless that evidence was actually obtained for the final head.

When visual evidence is obtained, show the relevant capture/video. When it is not obtained, state that briefly only when materially relevant.

Normal user-facing completion is intentionally compact:

- what changed
- merged to `develop`
- PR link when useful

Do not print validated-head SHA, validation run URL, merge commit SHA, or CI internals unless the user asks for them or they are needed to explain a blocker.

Do not delay the final response waiting for DEV publication.

## Production

`main` / Production changes require explicit user permission. Never weaken Production quality gates.
