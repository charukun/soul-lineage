# soul-lineage development

`develop` is the implementation source of truth. `main` is Production.

## Start

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file and only the task-specific document you actually need.
3. In a git workspace, run `npm run context:plan -- --task "<short summary>"` when useful.
4. Do not preload past chats, all docs, merged PR history, huge diffs, or full CI logs.

## Astra fast flow

1. **Implement** — start from latest `develop`, use a work branch / PR, implement in a git workspace, and run affected focused test/build.
2. **Sync & merge** — merge-forward current `develop`, revalidate, push, verify freshness, mark Ready, then the same task worker merges the exact validated head to `develop`.
3. **Deploy** — the `develop` push starts asynchronous DEV publication. Do not wait or poll for it.

Ready for review is transient, not a success terminal. Normal success is `MERGED_TO_DEVELOP`. Report `FAILED` only when a real blocker remains.

A qualifying Micro Patch may skip Draft PR creation, but never skips focused validation, latest-develop reconciliation, freshness verification, or same-task merge. See `docs/MICRO_PATCH_FAST_LANE.md`.

## Git workspace and GitHub

- Edit source code, configuration, tests, and docs only in a git workspace.
- If no workspace exists, create one with clone / worktree / Codespaces.
- GitHub API / Connector is for GitHub management such as SHA, PR, review/status, and merge. Do not use it to edit repository files.
- One failed tool, transport, or command is not task failure. Preserve the branch and continue through another git workspace route.
- Do not poll CI, Actions, browser checks, or DEV publication.
- Never change `main` / Production without explicit user permission.
- Never weaken tests, review requirements, browser assertions, exact-head checks, or Production gates.

## Architecture

- Apps stay under `apps/<id>`; shared code stays under `packages/<id>`. Apps do not import apps; packages do not import apps.
- Game/domain logic uses platform ports; browser/SDK/storage/render bootstrap belongs in adapters/bootstrap.
- Tidebreak integration belongs to `apps/rinne`.
- Validate affected apps/packages and any touched control-plane contract.

## Task routing

| Task | Read |
| --- | --- |
| Routine implementation | `docs/DEVELOPMENT.md` |
| Micro Patch | `docs/MICRO_PATCH_FAST_LANE.md` |
| develop merge / DEV publication | `docs/DEVELOP_MERGE.md` |
| Context retrieval | `docs/CONTEXT_EFFICIENCY.md` |
| Browser repair | `docs/BROWSER_SELF_HEALING.md` |
| Explicit browser playtest | `docs/BROWSER_PLAYTEST_ROUTING.md` |
| Distribution | `docs/DISTRIBUTION_ARCHITECTURE.md` |
| Character / DCC | `docs/art/README.md` and routed `docs/characters/` docs |
| Dedicated dispatched worker | `docs/DISPATCHER.md` |

Specialized character, motion, browser, distribution, and DCC contracts still apply when that task is requested. Do not read them preemptively.
