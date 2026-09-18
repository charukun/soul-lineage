# soul-lineage development

`develop` is the implementation source of truth. `main` is Production.

## Start

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file and only the task-specific document you actually need.
3. If a checked-out workspace is already available, use `npm run context:plan -- --task "<short summary>"` when useful.
4. Do not preload past chats, all docs, merged PR history, huge diffs, or full CI logs.

## Astra fast flow

1. **Implement** — start from latest `develop`, use a dedicated work branch / PR, construct the implementation on that branch through the connected GitHub Connector, then run affected focused validation against the exact head in a GitHub Actions hosted checkout.
2. **Sync & merge** — re-read current `develop`; if it advanced, reconcile it into the same work branch, re-run focused validation on the reconciled exact head, verify freshness, mark Ready, then the same task worker merges that exact validated head to `develop`.
3. **Deploy** — the `develop` push starts asynchronous DEV publication. Do not wait or poll for it.

Ready for review is transient, not a success terminal. Normal success is `MERGED_TO_DEVELOP`. Report `FAILED` only when a real blocker remains.

A qualifying Micro Patch may skip Draft PR creation, but never skips focused validation, latest-develop reconciliation, freshness verification, or same-task merge. See `docs/MICRO_PATCH_FAST_LANE.md`.

## Connector and Actions execution

- The canonical Chat execution path does not require a local clone, direct `github.com` DNS, `git push`, or Codespaces.
- Use the connected GitHub Connector to read current source and construct work-branch changes with Contents / Git Data operations such as blob, tree, commit, and ref updates.
- Code Mode / V8 syntax or consistency checks are preflight only. Do not treat them as formal focused validation.
- Formal focused test/check/build evidence must come from the exact work head checked out in `Astra Work Validation` GitHub Actions hosted runner or another real repository checkout.
- The head merged to `develop` must be the same exact head that passed the required focused validation after latest-develop reconciliation.
- One failed local tool, DNS path, transport, or command is not task failure. Preserve the same branch / PR and continue through the Connector + repository workflow path.
- Do not use watch/sleep loops for unrelated CI, browser checks, or DEV publication. Task-owned exact-head focused validation is part of implementation and must have recorded evidence before Ready / merge.
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
