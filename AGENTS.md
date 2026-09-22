# soul-lineage development

`develop` is the implementation source of truth. `main` is Production.

## Start

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file and only the task-specific document you actually need.
3. If a checked-out workspace is already available, use `npm run context:plan -- --task "<short summary>"` when useful.
4. Do not preload past chats, all docs, merged PR history, huge diffs, or full CI logs.

## Exoskeleton doctrine

The repository's development process is a **capability-gap exoskeleton**, not permanent product architecture.

- No current autonomous mechanism is presumed permanent. Tests, CI, browser review, staging, evidence, experiment schemas, telemetry, iteration contracts, and merge choreography exist because of current model/tool/operational gaps and may be removed or replaced when those gaps disappear.
- Current requirements remain mandatory until an explicit contract change removes them. Never self-declare a model "smart enough" and silently skip today's gates inside an ordinary task.
- Framework changes should reduce hidden coupling. Every new scaffold must name the gap it compensates for, its dependencies, and a condition under which it can be detached.
- When a newer model/tool can achieve equal or better outcomes with less external process, deleting ceremony is an improvement, not a regression.
- Zero autonomous scaffolding is a valid future endpoint. Do not preserve a mechanism merely because it is established practice.

The detailed doctrine is `.autonomous/EXOSKELETON.md`; the machine-readable inventory is `.autonomous/exoskeleton.json`. Autonomous framework changes must keep them aligned.

## Astra fast flow

1. **Implement** — start from latest `develop` and construct the coherent final tree through the connected GitHub Connector before creating a routine branch. For routine Fast DEV, create the final commit detached from refs, then create a short-lived `routine/txn-*` head branch directly at that commit and open the PR non-draft. Do not create an empty/preflight branch, do not move the branch twice, and do not use Draft/Ready choreography unless recovery or heavy/specialist work actually needs it.
2. **Validate once, merge safely** — when implementation is coherent, re-read current `develop`, but do not reconcile solely because its SHA advanced. Routine Fast DEV uses a connector-native exact-bytes proof: validate the final source bytes before blob creation, write those same bytes through Git Data, create the final commit detached, create the branch at that exact commit, and open the PR already Ready. Then perform one merge-window read of current `develop`; if it is unchanged, merge immediately with `expected_head_sha` without a separate PR/status/mergeability read. If `develop` moved, classify only that drift and reconcile only on conflict or affected-scope overlap. Heavy/specialist work keeps the hosted exact-head runner.
3. **Deploy** — the `develop` push starts asynchronous DEV publication. Do not wait or poll for it.

Ready for review is transient, not a success terminal. Normal success is `MERGED_TO_DEVELOP`. Report `FAILED` only when a real blocker remains.

A qualifying Micro Patch may use a lighter authoring path, but still performs one final merge-owning validation, impact-aware freshness verification, and same-task merge. Reconcile only when the freshness gate finds conflict or impact overlap. See `docs/MICRO_PATCH_FAST_LANE.md`.

## Connector and Actions execution

- The canonical Chat execution path does not require a local clone, direct `github.com` DNS, `git push`, or Codespaces.
- Use the connected GitHub Connector to read current source and construct work-branch changes with Contents / Git Data operations such as blob, tree, commit, and ref updates.
- Treat the GitHub Connector as the control plane, not as a bulk data transport. Prefer small source/config/workflow/manifest changes through Connector operations.
- **Routine Connector round-trip budget:** normal success has three phases only: (1) one batched source/context acquisition; (2) validate final bytes, then `blobs -> tree -> detached commit -> create branch at commit -> create non-draft PR`; (3) read current `develop` once and, when unchanged from the commit parent, merge immediately with `expected_head_sha`, then fetch the merge commit once. Do not call `update_ref`, `mark Ready`, PR-info/status reads, or validation Actions in the unchanged-base routine path. Use `routine/txn-*` for the head branch. Its deletion is asynchronous after merge and is never a waiting stage.
- A second source/write/validation phase is recovery-only and needs a concrete trigger: exact-head validation failure, merge conflict, affected-scope overlap, changed upstream state that invalidates cached metadata, or a transport/tool failure that forces another supported path. "Check again", "just in case", and authoring curiosity are not triggers.
- Create the final implementation commit with `[astra-validate]` when practical so the coherent write is also the merge-owning candidate. Do not push a preflight candidate merely to inspect CI.
- Treat GitHub Actions hosted runners as the repository-scale data/compute plane when work requires many files, large binaries, generated assets, dependency acquisition, archive expansion, conversion, optimization, or other heavy processing.
- Do not bypass Connector payload limits by splitting large files into many chunks when a runner can fetch, generate, unpack, transform, or optimize the same data from a stable source. Commit the small control inputs (source URL, manifest, script, or workflow) and let the runner materialize the bulk data.
- For bulk/heavy work, prefer in order: an existing repository Actions path; a task-scoped runner path that preserves the Fast DEV contract; ordinary Connector commits; Connector chunking only when no runner-side or source-side materialization path is available.
- A Connector transfer-size or transport limitation is recoverable execution-path pressure, not a task blocker. Preserve the same branch / PR, avoid chunk-splitting solely to force bulk transport through Connector, and switch the heavy operation to the repository Actions path when possible.
- For routine Fast DEV only, a syntax/consistency check becomes formal when it is run against the final in-memory bytes immediately before those exact bytes are sent to GitHub `create_blob`; the returned blob SHA plus the final tree/commit is the immutable validation coordinate. Checks against a different copy, stale fetch, or post-hoc reconstruction are preflight only. Heavy/specialist work still requires hosted exact-head execution.
- Do not run or wait on merge-owning validation for every intermediate branch push. Earlier, cancelled, or stale runs are disposable implementation noise and must never terminate the task.
- Routine merge-owning evidence is connector-native: checked final bytes -> GitHub blob SHAs -> final tree/commit -> PR head identity -> mergeability/freshness verification. Heavy/specialist merge-owning evidence must come from the exact work head materialized in `Astra Work Validation` or another real repository checkout.
- Final work-head commits still include `[astra-validate]` and explicit `Astra-Check:`, `Astra-Test:`, `Astra-Build:`, or `Astra-Validation: none` lines. Add `[astra-heavy-validation]` only when a hosted runner is actually required. Without that marker, `Astra Work Validation` creates no runner job.
- The PR head merged to `develop` must remain the exact head that passed validation. If the PR head moves, validate the new head. If only `develop` moves, reuse the validation when the merge is clean and the new develop delta is independent by affected app/package/build/control-plane scope; otherwise reconcile and revalidate.
- When conflict or impact overlap requires reconciliation, that replacement branch tip is the **final reconciled head** and must pass the new merge-owning validation before merge.
- One failed local tool, DNS path, transport, cancelled stale workflow, or command is not task failure. Preserve the same branch / PR and continue through the Connector + repository workflow path.
- Do not use watch/sleep loops for unrelated CI, browser checks, DEV publication, or routine-ref cleanup. Heavy merge-owning validation is the only CI waiting stage when explicitly required.
- Routine Fast DEV has no validation Actions result to inspect. The PR-creation response already fixes the expected head. Read current `develop` once immediately before merge. If it still equals the final commit parent, call merge directly with `expected_head_sha`; GitHub's merge operation itself is the mergeability gate. Only when `develop` advanced do a compare/freshness classification before merge. Fetch the resulting merge commit once to confirm the validated head parent. Heavy/specialist validation remains status-first through `actions:summary`.
- Routine `routine/txn-*` branches are transport refs, not durable work branches. After a successful merge to `develop`, an asynchronous cleanup job deletes only that merged PR head ref. Cleanup failure does not invalidate the already-merged source and must not block user-facing completion.
- Never change `main` / Production without explicit user permission.
- Routine DEV intentionally does not pre-detect launch failures, gameplay/animation oddities, visual regressions, or other player-facing runtime defects. The user may discover those by playing DEV and request the next patch. Keep the exact-head contract/freshness merge safety, and do not weaken explicitly requested specialist/autonomous validation or Production gates.
- User-facing completion reports are concise by default: say what changed and that it was merged to `develop`, plus the PR link when useful. Do not print validation SHA, validation run URL, merge SHA, or CI internals unless the user asks for them or they are needed to explain a blocker.

## Session naming contract

- As soon as the final routine PR is created, rename the current ChatGPT session to `PR #<number> <concise task content>` when the runtime exposes a supported conversation-title mutation. Routine work intentionally creates the PR late, after the final commit exists.
- If the runtime cannot rename the session, immediately surface that exact title candidate in the chat and explicitly state that the rename itself could not be executed. Do not silently leave the session unnamed and do not claim that the rename succeeded.
- Reuse the same PR number and title candidate for the rest of the task unless the task scope materially changes. Do not create a replacement PR only to obtain a different session title.
- The session-title step is metadata only. It never replaces implementation, validation, freshness checks, Ready transition, or merge to `develop`.

### Fast DEV execution contract

- The Fast DEV Actions surface is a hard anti-expansion ceiling. Without an explicit user request to change the Fast DEV contract itself, never add persistent Actions jobs/steps, automatic test sweeps, unconditional builds, new network/materialization work, or heavier lifecycle commands to the validation path.
- Routine Fast DEV does not start `Astra Work Validation`. Before writing the final commit, the connector-native lane must fail closed if ordinary work changes the workflow, focused runner, Fast DEV contract, freshness classifier, or build lifecycle. Explicit Fast DEV contract changes use `[astra-contract-change]` plus `[astra-heavy-validation]` and are verified once by the hosted runner. Dependency installation remains heavy-only.
- Repository-wide syntax scans, code-health, visual-budget, production-asset audits, and all-affected-app builds are not default merge-owning Actions work. Astra may choose the smallest relevant check/test/build for the task and must declare it on the final commit.
- Routine Fast DEV validates repository safety, not product behavior. Use `Astra-Validation: none` when no source syntax check is applicable, otherwise targeted `Astra-Check` for changed JS/source syntax. Routine Fast DEV must not select `Astra-Test`, `Astra-Build`, browser/integration/runtime tests, startup checks, or visual/interaction evidence. Those run only when the user explicitly requests heavy/specialist validation and the final commit carries `[astra-heavy-validation]` where applicable.
- Routine Fast DEV must not automatically add staging, browser/Playwright, rendered-output, DCC, screenshot, startup/runtime checks, or evidence-observation work merely because a change is player-facing. A temporarily broken DEV experience is acceptable feedback surface; fix it in the next patch after the user notices it. Use specialist routes only when explicitly requested or when the selected autonomous contract itself requires them.
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
| Autonomous improvement: village / 喰滅廻遊 / 百年転生, 1 or N iterations | `.autonomous/README.md`, `.autonomous/prompts/run-iteration.md`, then the selected game's charter/protected rules/recent history |
| Micro Patch | `docs/MICRO_PATCH_FAST_LANE.md` |
| develop merge / DEV publication | `docs/DEVELOP_MERGE.md` |
| Context retrieval | `docs/CONTEXT_EFFICIENCY.md` |
| Browser repair | `docs/BROWSER_SELF_HEALING.md` |
| Explicit browser playtest | `docs/BROWSER_PLAYTEST_ROUTING.md` |
| Distribution | `docs/DISTRIBUTION_ARCHITECTURE.md` |
| Character / DCC | `docs/art/README.md` and routed `docs/characters/` docs |

Specialized character, motion, browser, distribution, and DCC source contracts still apply when that task is requested, but routine execution stays on the canonical Astra lane. Do not read them preemptively.

For 「村アプリを1 iteration自律改善してください」, 「喰滅廻遊を1 iteration自律改善してください」, or 「百年転生を1 iteration自律改善してください」, use the autonomous route above (`village` / `kuumetsu` / `rinne` respectively). Preserve the Fast DEV ceiling and existing quality gates. Gameplay iterations start from an immutable staging observation bound to an exact source SHA; never use a mutable latest-DEV page as Before/After evidence. For Evolution/Polish and other player-facing iterations, publish and observe the exact candidate After before arming the final merge-owning `[astra-validate]` head; if observation changes the candidate, re-stage it before formal validation. Browser observation is evidence discovery, not a substitute for causal/native validation. Completion still requires validated exact-head merge to develop in this session, not Ready alone.
