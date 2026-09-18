# Development

Routine implementation is Astra-driven and has three stages.

## 1. Implement

- Confirm latest `develop` and `AGENTS.md`.
- Work in a git workspace on a dedicated branch.
- Normal work uses a Draft PR; a qualifying Micro Patch follows `MICRO_PATCH_FAST_LANE.md`.
- Implement the request and run affected focused test/check/build.
- Do not edit repository files through GitHub API / Connector.

## 2. Sync and merge

Before Ready:

```sh
npm run pre-ready:sync
# run affected focused validation again
git push
npm run pre-ready:verify
```

Resolve real conflicts semantically. Never choose ours/theirs blindly and never weaken a quality gate.

If current `develop` advances, repeat sync → focused validation → push → verify.

When fresh, mark the PR Ready and, in the same task/session, merge the exact validated PR head to `develop`. Ready is not a handoff or success state.

## 3. DEV publication

The resulting `develop` push starts asynchronous DEV publication. Do not wait or poll for completion.

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

A failed command or transport is not itself a blocker. Keep the same branch and continue in another git workspace route, including Codespaces when needed.

Never modify `main` / Production without explicit permission. Never weaken tests, browser assertions, review requirements, exact-head checks, or Production gates.
