# soul-lineage development

`develop` is the implementation source of truth. `main` is Production.

## Start

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file and only the task-specific document you actually need.
3. If a checked-out workspace is already available, use `npm run context:plan -- --task "<short summary>"` when useful.
4. Do not preload past chats, all docs, merged PR history, huge diffs, or full CI logs.

## Astra fast flow

1. **Implement** — start from latest `develop`, use a dedicated work branch / Draft PR, and construct the implementation through the connected GitHub Connector. Prefer composing a coherent final tree and updating the branch once instead of pushing every tiny intermediate edit. Intermediate pushes never justify waiting for CI.
2. **Sync, validate once, merge** — when implementation is coherent, re-read current `develop`; if it advanced, reconcile it into the same branch. Then arm exactly one merge-owning validation for that final reconciled head by making the final/refreshed commit message contain `[astra-validate]`. Ignore stale/cancelled runs for earlier heads. When that exact final head passes, verify freshness, mark Ready, and merge it to `develop` in the same task/session.
3. **Deploy** — the `develop` push starts asynchronous DEV publication. Do not wait or poll for it.

Ready for review is transient, not a success terminal. Normal success is `MERGED_TO_DEVELOP`. Report `FAILED` only when a real blocker remains.

A qualifying Micro Patch may use a lighter authoring path, but still performs latest-develop reconciliation, one final merge-owning validation, freshness verification, and same-task merge. See `docs/MICRO_PATCH_FAST_LANE.md`.

## Connector and Actions execution

- The canonical Chat execution path does not require a local clone, direct `github.com` DNS, `git push`, or Codespaces.
- Use the connected GitHub Connector to read current source and construct work-branch changes with Contents / Git Data operations such as blob, tree, commit, and ref updates.
- Code Mode / V8 syntax or consistency checks are preflight only. Do not treat them as formal focused validation.
- Do not run or wait on merge-owning validation for every intermediate branch push. Earlier, cancelled, or stale runs are disposable implementation noise and must never terminate the task.
- Formal merge-owning test/check/build evidence must come from the final reconciled work head checked out in `Astra Work Validation` GitHub Actions hosted runner or another real repository checkout.
- Arm that run explicitly only after implementation and latest-`develop` reconciliation are complete: the commit that becomes the final branch head must include `[astra-validate]` in its commit message.
- The head merged to `develop` must be that same final reconciled head. If either PR head or `develop` moves afterward, reconcile first and make the new reconciled head the next `[astra-validate]` commit; do not chase superseded runs.
- One failed local tool, DNS path, transport, cancelled stale workflow, or command is not task failure. Preserve the same branch / PR and continue through the Connector + repository workflow path.
- Do not use watch/sleep loops for unrelated CI, browser checks, or DEV publication. Only the single merge-owning final-head validation is a waiting stage before Ready / merge.
- Never change `main` / Production without explicit user permission.
- Never weaken tests, review requirements, browser assertions, the single final-head merge gate, or Production gates.
- User-facing completion reports are concise by default: say what changed and that it was merged to `develop`, plus the PR link when useful. Do not print validation SHA, validation run URL, merge SHA, or CI internals unless the user asks for them or they are needed to explain a blocker.

### Fast DEV execution contract

- The existing Fast DEV Actions workload is a ceiling, not a template to extend. Without an explicit user request to change the Fast DEV contract itself, never add an Actions job/step, increase the number of test cases executed by Actions, change a Fast DEV lifecycle command (`predev`, `prebuild`, `build`, `postbuild`), or add network/materialization work to the validation path.
- `Astra Work Validation` must run the contract check from current `develop` before dependency scripts, focused tests, or builds. Branch-authored changes cannot authorize themselves. Dependency installation uses `npm ci --ignore-scripts`.
- `astra/fast-dev-contract=error` is a recoverable self-inflicted violation, not `FAILED`. Keep the same branch / PR, identify the attempted expansion from the receipt, remove it or move it outside Fast DEV, then create a new final head and validate again. Do not ask the user how to recover from your own violation.
- A contract violation intentionally does not make the GitHub merge button mechanically impossible. Astra must nevertheless not mark Ready or merge while the violation remains, unless the user explicitly requested a Fast DEV contract change in the current task.
- For an explicit user-requested workflow reduction only, the final merge-owning commit also includes `[astra-contract-change]`. That marker authorizes only a contraction to the canonical workflow surface; it never authorizes adding Actions work.
- If the task hit this violation and self-repaired it, say so in the completion report. Never hide or relabel the attempted expansion as ordinary CI noise.

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

Specialized character, motion, browser, distribution, and DCC source contracts still apply when that task is requested, but routine execution stays on the canonical Astra lane. Do not read them preemptively.
