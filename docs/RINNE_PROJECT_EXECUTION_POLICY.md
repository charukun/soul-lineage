# Implementation execution policy

## Source of truth and completion

The source of truth is latest `develop` plus current GitHub branch / commit / PR / status.

Routine implementation finishes only after the same task worker merges the exact validated PR head to `develop`.

```text
Connector-built implementation head
  -> exact-head focused validation in a real checkout
  -> current develop reconciliation
  -> reconciled exact-head focused revalidation
  -> freshness verification
  -> Ready + same-task merge
  -> asynchronous DEV publication
```

Ready is not success. DEV publication is not a merge prerequisite.

## Canonical Chat execution path

For Chat sessions, the canonical implementation path is:

1. Read latest `develop` and current repository state through the connected GitHub Connector.
2. Create or reuse one dedicated work branch / PR.
3. Construct implementation changes on that branch through GitHub Contents / Git Data operations such as blob, tree, commit, and ref updates.
4. Validate the exact head in the `Astra Work Validation` GitHub Actions hosted runner or another real repository checkout.
5. Re-read latest `develop`; if it advanced, reconcile it into the same branch and validate the reconciled exact head again.
6. Verify freshness, mark Ready, and merge the exact validated head to `develop` in the same task/session.
7. Let the resulting `develop` push start asynchronous DEV publication.

A local clone, direct `github.com` DNS, local `git push`, and Codespaces are not prerequisites for this path.

## Validation boundary

Code Mode / V8 syntax checks, manifest checks, source inspection, and other in-Chat checks are useful preflight evidence, but they are not a substitute for required focused test/check/build on the exact repository head.

The merge candidate must exactly match the head that passed required focused validation after latest-develop reconciliation. If the PR head or `develop` moves, revalidate instead of merging stale evidence.

Do not use Connector writes to bypass tests, review, browser assertions, freshness, exact-head verification, or Production protections.

## No waiting or polling

Do not use watch/sleep polling loops such as `gh run watch`, `gh pr checks --watch`, repeated API reads, or sleep loops for ordinary CI, browser verification, or DEV publication.

Task-owned exact-head focused validation is an implementation requirement, not optional post-Ready CI. Obtain its recorded result before Ready / merge, but do not poll unrelated queued/running workflows or wait for DEV publication.

A one-time immediate check for an obvious launch/configuration failure is fine.

## Autonomous decisions

Within confirmed requirements, Astra chooses reversible implementation details, UI details, wording, and technical approach. Do not add a human approval step merely because visual review may happen later on DEV.

Ask for human input only when the task truly requires an irreversible/compatibility-breaking decision, user authentication, new paid resources, or another decision not derivable from current requirements.

## Failure and recovery

One failed tool, transport, command, local capability, DNS path, `git push`, or Codespaces route is not task failure.

Preserve the same branch / PR / exact head and continue through the connected GitHub Connector plus existing repository workflow / evidence routes. Do not create a replacement PR merely because one transport failed.

Report `FAILED` only when a concrete blocker remains after applicable Connector and repository workflow routes are exhausted, with repository / branch / exact head / PR / reason.

## Evidence and final report

Do not claim browser, image, motion, test, or build verification unless that evidence was actually obtained for the exact head.

When visual evidence is obtained, show the relevant capture/video. When it is not obtained, state that briefly instead of blocking develop merge solely to wait for optional evidence.

The final implementation report should stay compact and include:

- what changed
- PR
- validated exact head
- develop merge commit SHA
- focused validation performed
- visual evidence, or a brief reason it was not obtained

Do not delay the final response waiting for DEV publication.

## Production

`main` / Production changes require explicit user permission. Never weaken Production quality gates.
