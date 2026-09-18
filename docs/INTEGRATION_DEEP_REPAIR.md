# Integration Deep Repair Handoff

Fast Lane is the only normal merge entry for Ready PRs. Fast Repair handles only mechanically safe reconciliation in GitHub Actions. True semantic source repair must not silently choose one side of a conflict or weaken an existing gate.

## Work-free recovery model

The Integration control plane does **not** start ChatGPT Work, Codex, OpenAI API, a paid model API, a dedicated PAT, or a second autonomous worker when Fast Repair cannot safely finish.

Recovery is split into two layers:

1. **GitHub repair layer**: GitHub Actions performs deterministic recovery such as dependency follow-up, safe merge-forward, exact-head validation, browser rechecks, bounded retry and other repository-owned mechanical repair.
2. **Normal Chat handoff**: when a current exact head still requires semantic source repair, Fast Lane creates one machine-readable GitHub Issue for that exact head, assigns the repository owner, and includes a copy/paste prompt for a normal Chat session. The Issue is the recovery coordinate. GitHub notification delivery, including email, follows the owner's GitHub notification settings.

No background ChatGPT task is required. A normal Chat starts only when the user chooses to open one from the notification.

## Repository-side handoff

A semantic repair handoff must:

- Treat current GitHub state as canonical and pin source PR number, branch, exact head, current develop and reason.
- Create `integration/deep-repair` status plus one `integration-deep-repair:v1` Issue for the current exact head.
- Include a `chat-repair:v1` bundle and keep the existing `rinne-ai-repair:v1` envelope for compatibility with repository lookup/finalization.
- Deduplicate by `sourceKey=pr:<N>:head:<SHA>` so the same exact head produces at most one notification Issue.
- Assign `charukun` on first creation and use that assignment as the single owner wake-up event. Do not also `@mention` the owner in the Issue body because GitHub treats assignment and mention as separate notification causes. Re-evaluating the same head must not create a second notification.
- Never send explicit hold, Changes requested, unresolved review thread, unmerged dependency, external PR, main or Production into automatic source repair.
- Never invoke ChatGPT Work, Codex or OpenAI API as fallback.

Fast Repair capable `behind` / dependency reconciliation remains in the lightweight GitHub executor and does not create a Chat repair request.

## Chat repair bundle

The Issue body contains a copy/paste prompt for a **normal Chat**. The prompt is a wake-up instruction, not a frozen source of truth. The Chat must re-read current GitHub state before editing.

The prompt requires the Chat to:

1. Open the recorded Issue and source PR, then re-read current PR head and latest `develop`. If the recorded exact head is stale, do not repair the stale head; reconcile against current GitHub state or mark the Issue stale as appropriate.
2. Follow `AGENTS.md`. If a checkout exists, run `npm run context:plan -- --task "PR #<N> semantic repair"` and read only the returned documents that are needed.
3. Read the PR-side intent, develop-side intent, relevant governing contracts and focused tests. Preserve both intents when compatible. Unconditional `ours` / `theirs`, blind cherry-pick, assertion deletion and gate weakening are prohibited.
4. Repair only the existing source PR branch. Use normal git first, then the connected GitHub API, then the same branch in existing Codespaces when transport requires it.
5. Do not use ChatGPT Work, Codex, OpenAI API or any additional paid API/service.
6. Run the necessary focused checks and repository fast validation, push the validated repair, update the Issue recovery state, and return the same PR to normal Fast Lane / `READY_FOR_INTEGRATION`.
7. Never clear explicit holds, requested changes or unresolved review threads, never force-push, and never modify `main` or Production.
8. If the two sides require a real unresolved product/schema/save/protocol decision that cannot be made from confirmed repository contracts, mark the Issue `human-required` and record the exact decision needed instead of discarding one side.

## Meaning-preserving conflict handling

A true conflict is not resolved merely because Git can produce a tree. The repair Chat must compare both sides and construct a compatible third result when possible.

Examples include preserving a PR's gameplay improvement while adapting it to a newer stamina/save/rendering contract already present in develop. The desired outcome is not "pick PR" or "pick develop"; it is "preserve both confirmed intents without regressing gates".

Same-file overlap, technical difficulty or lack of immediate visual approval are not by themselves `human-required`. A stop is justified only when current repository contracts cannot determine a compatible implementation without an unapproved product decision.

## CI failure handoff

A current exact-head `Validate and build` failure/timed_out may use the same Issue route when source repair is required. The Issue records `repairKind=ci-failure` and the exact run/job identity. The normal Chat reads only the needed failed job steps/log excerpt before editing and must not weaken assertions to make the run green.

Stale heads, Draft observations, skipped/cancelled validation, old attempts and successful observation-only jobs are not repair evidence.

## Browser / DEV boundary

Browser smoke and DEV publication remain asynchronous GitHub lanes. Mechanical rerun/recheck stays in GitHub Actions. If a browser failure exposes a true source-level semantic repair requirement, it should be converted to the same owner-notified normal-Chat handoff rather than starting Work.

Independent Ready PRs continue through Fast Lane while another PR is waiting for a Chat repair. DEV publication continues to coalesce toward the latest develop SHA.

## Finalization

When the repaired source PR is later merged into develop, Integration updates the same `integration-deep-repair:v1` Issue to `completed`, records the final repair head and merge commit, closes the Issue, and marks `integration/deep-repair` successful. This remains idempotent and never converts `human-required` or attempt-exhausted decisions into success.

## Acceptance criteria

1. Mechanical recovery remains GitHub Actions only.
2. One semantic/CI source-repair request is created per source PR exact head.
3. The request contains `integration-deep-repair:v1`, `chat-repair:v1`, the compatibility envelope, current recovery coordinates and a normal-Chat copy/paste prompt.
4. First creation assigns the owner exactly once and does not also `@mention` them; re-evaluation of the same head does not duplicate the Issue or notification.
5. No ChatGPT Work, Codex, OpenAI API, dedicated PAT or paid fallback is required by Integration recovery.
6. Normal Chat repair preserves both compatible intents and all exact-head/review/thread/check/browser/Production gates.
7. Unresolvable product decisions become explicit `human-required` stops instead of blind conflict resolution.
8. `main` and Production remain unchanged by repair handoff.
