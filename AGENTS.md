# soul-lineage development

`develop` is the implementation source of truth. `main` is Production.

## Start

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file and only the task-specific document you actually need.
3. If a checked-out workspace is already available, use `npm run context:plan -- --task "<short summary>"` when useful.
4. Do not preload past chats, all docs, merged PR history, huge diffs, or full CI logs.

## Astra fast flow

1. **Implement** — start from latest `develop`, use a dedicated work branch / Draft PR, and construct the implementation through the connected GitHub Connector. Prefer composing a coherent final tree and updating the branch once instead of pushing every tiny intermediate edit. Intermediate pushes never justify waiting for CI.
2. **Validate once, merge safely** — when implementation is coherent, re-read current `develop`, but do not reconcile solely because its SHA advanced. Arm one merge-owning validation by making the final work-head commit contain `[astra-validate]`. After it passes, the freshness gate checks whether current `develop` still merges cleanly and whether its new affected app/package/build/control-plane scope overlaps the validated work. Independent mergeable drift reuses the validation; conflict or impact overlap requires reconciliation and one new validation. Then mark Ready and merge to `develop` in the same task/session.
3. **Deploy** — the `develop` push starts asynchronous DEV publication. Do not wait or poll for it.

Ready for review is transient, not a success terminal. Normal success is `MERGED_TO_DEVELOP`. Report `FAILED` only when a real blocker remains.

A qualifying Micro Patch may use a lighter authoring path, but still performs one final merge-owning validation, impact-aware freshness verification, and same-task merge. Reconcile only when the freshness gate finds conflict or impact overlap. See `docs/MICRO_PATCH_FAST_LANE.md`.

## Connector and Actions execution

- The canonical Chat execution path does not require a local clone, direct `github.com` DNS, `git push`, or Codespaces.
- Use the connected GitHub Connector to read current source and construct work-branch changes with Contents / Git Data operations such as blob, tree, commit, and ref updates.
- Treat the GitHub Connector as the control plane, not as a bulk data transport. Prefer small source/config/workflow/manifest changes through Connector operations.
- Treat GitHub Actions hosted runners as the repository-scale data/compute plane when work requires many files, large binaries, generated assets, dependency acquisition, archive expansion, conversion, optimization, or other heavy processing.
- Do not bypass Connector payload limits by splitting large files into many chunks when a runner can fetch, generate, unpack, transform, or optimize the same data from a stable source. Commit the small control inputs (source URL, manifest, script, or workflow) and let the runner materialize the bulk data.
- For bulk/heavy work, prefer in order: an existing repository Actions path; a task-scoped runner path that preserves the Fast DEV contract; ordinary Connector commits; Connector chunking only when no runner-side or source-side materialization path is available.
- A Connector transfer-size or transport limitation is recoverable execution-path pressure, not a task blocker. Preserve the same branch / PR, avoid chunk-splitting solely to force bulk transport through Connector, and switch the heavy operation to the repository Actions path when possible.
- Code Mode / V8 syntax or consistency checks are preflight only. Do not treat them as formal focused validation.
- Do not run or wait on merge-owning validation for every intermediate branch push. Earlier, cancelled, or stale runs are disposable implementation noise and must never terminate the task.
- Formal merge-owning evidence must come from the exact work head checked out in `Astra Work Validation` GitHub Actions hosted runner or another real repository checkout. Astra decides the task-specific focused validation; Actions executes that declared plan rather than repeating repository-wide review.
- Arm that run only after implementation is coherent: the final work-head commit must include `[astra-validate]` and explicit `Astra-Check:`, `Astra-Test:`, `Astra-Build:`, or `Astra-Validation: none` lines in its commit message.
- The PR head merged to `develop` must remain the exact head that passed validation. If the PR head moves, validate the new head. If only `develop` moves, reuse the validation when the merge is clean and the new develop delta is independent by affected app/package/build/control-plane scope; otherwise reconcile and revalidate.
- When conflict or impact overlap requires reconciliation, that replacement branch tip is the **final reconciled head** and must pass the new merge-owning validation before merge.
- One failed local tool, DNS path, transport, cancelled stale workflow, or command is not task failure. Preserve the same branch / PR and continue through the Connector + repository workflow path.
- Do not use watch/sleep loops for unrelated CI, browser checks, or DEV publication. Only the single merge-owning final-head validation is a waiting stage before Ready / merge.
- Never change `main` / Production without explicit user permission.
- Never weaken tests, review requirements, browser assertions, the single final-head merge gate, or Production gates.
- User-facing completion reports are concise by default: say what changed and that it was merged to `develop`, plus the PR link when useful. Do not print validation SHA, validation run URL, merge SHA, or CI internals unless the user asks for them or they are needed to explain a blocker.

## Session naming contract

- As soon as a task has a corresponding PR, rename the current ChatGPT session to `PR #<number> <concise task content>` when the runtime exposes a supported conversation-title mutation.
- If the runtime cannot rename the session, immediately surface that exact title candidate in the chat and explicitly state that the rename itself could not be executed. Do not silently leave the session unnamed and do not claim that the rename succeeded.
- Reuse the same PR number and title candidate for the rest of the task unless the task scope materially changes. Do not create a replacement PR only to obtain a different session title.
- The session-title step is metadata only. It never replaces implementation, validation, freshness checks, Ready transition, or merge to `develop`.

### Fast DEV execution contract

- The Fast DEV Actions surface is a hard anti-expansion ceiling. Without an explicit user request to change the Fast DEV contract itself, never add persistent Actions jobs/steps, automatic test sweeps, unconditional builds, new network/materialization work, or heavier lifecycle commands to the validation path.
- `Astra Work Validation` runs the anti-expansion contract before task-specific validation. Routine branches cannot rewrite the workflow, focused runner, contract, or freshness classifier. Dependency installation uses `npm ci --ignore-scripts` only when the Astra-selected test/build plan actually needs dependencies.
- Repository-wide syntax scans, code-health, visual-budget, production-asset audits, and all-affected-app builds are not default merge-owning Actions work. Astra may choose the smallest relevant check/test/build for the task and must declare it on the final commit.
- `astra/fast-dev-contract=error` is a recoverable self-inflicted violation, not `FAILED`. Keep the same branch / PR, identify the attempted expansion from the receipt, remove it or move it outside Fast DEV, then create a new final head and validate again. Do not ask the user how to recover from your own violation.
- A contract violation intentionally does not make the GitHub merge button mechanically impossible. Astra must nevertheless not mark Ready or merge while the violation remains, unless the user explicitly requested a Fast DEV contract change in the current task.
- For an explicit user-requested Fast DEV contraction only, the final merge-owning commit also includes `[astra-contract-change]`. That marker may reduce workflow count or per-run workload, but never authorizes adding persistent Actions work.
- If the task hit this violation and self-repaired it, say so in the completion report. Never hide or relabel the attempted expansion as ordinary CI noise.

## Canonical review URLs

- Public RINNE review URLs are extensionless. Use `/review-motion`, `/review-assets`, `/review-objects`, `/review-effects`, `/review-sound`, and `/review-battle`.
- The corresponding `.html` files are build entry implementation details only. Never use a public `.html` review URL in links, browser evidence, debugging, verification, documentation, or user-facing reports.
- Before diagnosing a public review regression, verify the canonical extensionless URL itself. A result from a `.html` path is not evidence about the canonical public route.
- When adding or renaming a review surface, update the canonical route map first and keep exactly one public URL per surface.

## Review UI invariant

- Review/catalog choice grids use exactly five equal-width columns by default, including phone layouts. Do not add responsive overrides that reduce these lists to 1–4 columns. If a particular surface genuinely cannot use five columns, that exception requires an explicit user request and a repository test documenting it.
- This five-column rule applies to selectable review lists such as motion, model, equipment, and object candidates; it does not force unrelated transport controls such as camera buttons or playback controls into five columns.

## Architecture

- Apps stay under `apps/<id>`; shared code stays under `packages/<id>`. Apps do not import apps; packages do not import apps.
- Game/domain logic uses platform ports; browser/SDK/storage/render bootstrap belongs in adapters/bootstrap.
- Tidebreak integration belongs to `apps/rinne`.
- Validate affected apps/packages and any touched control-plane contract.

## Task routing

| Task | Read |
| --- | --- |
| Routine implementation | `docs/DEVELOPMENT.md` |
| Autonomous improvement: village / 喰滅廻遊, 1 or N iterations | `.autonomous/README.md`, `.autonomous/prompts/run-iteration.md`, then the selected game's charter/protected rules/recent history |
| Micro Patch | `docs/MICRO_PATCH_FAST_LANE.md` |
| develop merge / DEV publication | `docs/DEVELOP_MERGE.md` |
| Context retrieval | `docs/CONTEXT_EFFICIENCY.md` |
| Browser repair | `docs/BROWSER_SELF_HEALING.md` |
| Explicit browser playtest | `docs/BROWSER_PLAYTEST_ROUTING.md` |
| Distribution | `docs/DISTRIBUTION_ARCHITECTURE.md` |
| Character / DCC | `docs/art/README.md` and routed `docs/characters/` docs |

Specialized character, motion, browser, distribution, and DCC source contracts still apply when that task is requested, but routine execution stays on the canonical Astra lane. Do not read them preemptively.

For 「村アプリを1 iteration自律改善してください」 or 「喰滅廻遊を1 iteration自律改善してください」, use the autonomous route above (`village` / `kuumetsu` respectively). Preserve the Fast DEV ceiling and existing quality gates. Gameplay iterations start from an immutable staging observation bound to an exact source SHA; never use a mutable latest-DEV page as Before/After evidence. Browser observation is evidence discovery, not a substitute for causal/native validation. Completion still requires validated exact-head merge to develop in this session, not Ready alone.
