# Implementation execution policy

## Source of truth and completion

The source of truth is latest `develop` plus current GitHub branch / commit / PR / status.

Routine implementation finishes only after the same task worker merges the exact validated PR head to `develop`.

```text
implement + focused validation
  -> current develop sync + focused revalidation
  -> Ready + same-task merge
  -> asynchronous DEV publication
```

Ready is not success. DEV publication is not a merge prerequisite.

## No waiting or polling

Do not use CI/Actions/browser/DEV polling loops such as `gh run watch`, `gh pr checks --watch`, repeated API reads, or sleep loops.

A one-time immediate check for an obvious launch/configuration failure is fine. Do not wait for queued/running jobs.

## Autonomous decisions

Within confirmed requirements, Astra chooses reversible implementation details, UI details, wording, and technical approach. Do not add a human approval step merely because visual review may happen later on DEV.

Ask for human input only when the task truly requires an irreversible/compatibility-breaking decision, user authentication, new paid resources, or another decision not derivable from current requirements.

## Failure and recovery

One failed tool, transport, command, or local capability is not task failure.

Preserve the same branch / PR / exact head and recover through another git workspace route. Do not use GitHub file APIs as an implementation fallback.

Report `FAILED` only when a concrete blocker remains, with repository / branch / exact head / PR / reason.

## Evidence and final report

Do not claim browser, image, or motion verification unless that evidence was actually obtained for the exact head.

When visual evidence is obtained, show the relevant capture/video. When it is not obtained, state that briefly instead of blocking develop merge solely to wait for evidence.

The final implementation report should stay compact and include:

- what changed
- PR
- validated exact head
- develop merge commit
- focused validation performed
- visual evidence, or a brief reason it was not obtained

Do not delay the final response waiting for DEV publication.

## Production

`main` / Production changes require explicit user permission. Never weaken Production quality gates.
