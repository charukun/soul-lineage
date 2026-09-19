# soul-lineage development

`develop` is the implementation source of truth. `main` is Production.

## Start

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file and only the task-specific document you actually need.
3. If a checked-out workspace is already available, use `npm run context:plan -- --task "<short summary>"` when useful.
4. Do not preload past chats, all docs, merged PR history, huge diffs, or full CI logs.

## Astra fast flow

1. **Implement** — start from latest `develop`, use a dedicated work branch / Draft PR, and construct the implementation through the connected GitHub Connector. Prefer composing a coherent final tree and updating the branch once instead of pushing every tiny intermediate edit. Intermediate pushes never justify waiting for CI.
2. **Sync, validate once, merge** — when implementation is coherent, re-read current `develop`; if it advanced, reconcile it into the same branch. Then arm exactly one merge-owning validation for that final reconciled head by putting `Astra-Validate: <head SHA>` in the Draft PR body. Ignore stale/cancelled runs for earlier heads. When that exact final head passes, verify freshness, mark Ready, and merge it to `develop` in the same task/session.
3. **Deploy** — the `develop` push starts asynchronous DEV publication. Do not wait or poll for it.

Ready for review is transient, not a success terminal. Normal success is `MERGED_TO_DEVELOP`. Report `FAILED` only when a real blocker remains.

A qualifying Micro Patch may use a lighter authoring path, but still performs latest-develop reconciliation, one final merge-owning validation, freshness verification, and same-task merge. See `docs/MICRO_PATCH_FAST_LANE.md`.

## Connector and Actions execution

- The canonical Chat execution path does not require a local clone, direct `github.com` DNS, `git push`, or Codespaces.
- Use the connected GitHub Connector to read current source and construct work-branch changes with Contents / Git Data operations such as blob, tree, commit, and ref updates.
- Code Mode / V8 syntax or consistency checks are preflight only. Do not treat them as formal focused validation.
- Do not run or wait on merge-owning validation for every intermediate branch push. Earlier, cancelled, or stale runs are disposable implementation noise and must never terminate the task.
- Formal merge-owning test/check/build evidence must come from the final reconciled work head checked out in `Astra Work Validation` GitHub Actions hosted runner or another real repository checkout.
- Arm that run explicitly on the Draft PR by setting `Astra-Validate: <head SHA>` in the PR body only after implementation and latest-`develop` reconciliation are complete.
- The head merged to `develop` must be that same final reconciled head. If either PR head or `develop` moves afterward, reconcile first and arm one new final-head run; do not chase superseded runs.
- One failed local tool, DNS path, transport, cancelled stale workflow, or command is not task failure. Preserve the same branch / PR and continue through the Connector + repository workflow path.
- Do not use watch/sleep loops for unrelated CI, browser checks, or DEV publication. Only the single merge-owning final-head validation is a waiting stage before Ready / merge.
- Never change `main` / Production without explicit user permission.
- Never weaken tests, review requirements, browser assertions, the single final-head merge gate, or Production gates.
- User-facing completion reports are concise by default: say what changed and that it was merged to `develop`, plus the PR link when useful. Do not print validation SHA, validation run URL, merge SHA, or CI internals unless the user asks for them or they are needed to explain a blocker.

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
