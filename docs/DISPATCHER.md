# RINNE Dispatcher

RINNE Dispatcher turns one short instruction into an isolated implementation work item while keeping GitHub, not a Chat/agent session, as the source of truth.

## Current route: ChatGPT Work, no Platform API credits

The active route does **not** call the OpenAI Platform API from GitHub Actions and does not use `OPENAI_API_KEY`. No separate OpenAI Platform API credits are required for the normal Dispatcher route.

The flow is:

```text
Project Chat / WORK
  -> dispatch/<slug> branch
  -> Draft PR with RINNE-Dispatch marker
  -> GitHub pull request opened event
  -> ChatGPT Work event-triggered task
  -> implementation on the same branch/PR
  -> affected fast verification
  -> commit / push
  -> Ready for review
  -> READY_FOR_INTEGRATION
  -> existing Integration
  -> develop / DEV
```

The GitHub workflow `.github/workflows/rinne-dispatch.yml` is intentionally only a handoff validator/recorder. It must never invoke `openai/codex-action`, use `OPENAI_API_KEY`, or silently fall back to a paid API route.

ChatGPT Work event-triggered tasks use the connected GitHub app and the user's eligible ChatGPT plan. No separate OpenAI Platform API credits are required. Normal ChatGPT plan limits and connected-app approval requirements still apply.

The canonical implementation-session boundary is [RINNE_PROJECT_EXECUTION_POLICY.md](RINNE_PROJECT_EXECUTION_POLICY.md). The Work task ends at push + Ready + `READY_FOR_INTEGRATION`. Running / Queued / Pending CI or browser checks are not waited on. The existing Integration path owns asynchronous CI/browser monitoring, merge, DEV publication, repair and delivery notifications.

## User-facing command

A project Chat may treat requests such as these as dispatch requests when the work is self-contained and can run without repeated human visual/semantic decisions:

- `派生して。Villageの初回建築導線を改善`
- `別セッションで。faviconの不具合を直して`
- `この小修正を並列で進めて`

Interactive design work, ambiguous specification work, large visual iteration, and tasks that need repeated human feedback remain normal Chat / WORK sessions.

## Bootstrap contract

For an implementation dispatch, the initiating Chat/WORK performs only the bootstrap below. It does not implement the requested code itself.

1. Re-read latest `develop`, `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/INTEGRATION.md`, `docs/RINNE_PROJECT_EXECUTION_POLICY.md`, this file, and relevant app/package documentation.
2. Create `dispatch/<short-slug>` from current latest `develop`.
3. Add one temporary `.task-start/<short-slug>.md` marker containing scope and recovery information. This is only the meaningful initial diff needed to create the Draft PR.
4. Open a develop-targeting **Draft PR**. The body must begin with the normal two-line contract, then contain:

```text
RINNE-Dispatch: implementation

## Request
<the implementation request>
```

5. Stop the bootstrap role. The PR-open event is the handoff point for ChatGPT Work.

No separate task identifier or task database is created. The branch, Draft PR, head SHA, Work task execution, later Ready PR and GitHub history are the recovery coordinates.

## Eligibility

A dispatch PR is eligible only when all of these conditions are true:

- PR is Draft.
- base is `develop`.
- head belongs to the same repository.
- head branch starts with `dispatch/`.
- author association is `OWNER`, `MEMBER`, or `COLLABORATOR`.
- PR body contains `RINNE-Dispatch: implementation` and a non-empty `## Request` section.

The repository handoff workflow validates the same contract and records `dispatch/handoff=success` plus a PR comment. That status means only that the PR is eligible for the ChatGPT Work task. It does not mean implementation, CI, merge or DEV publication succeeded.

## One-time ChatGPT Work setup

This setup is performed once in ChatGPT. It is not stored as a repository secret.

1. Open `Settings > Apps` in ChatGPT and connect GitHub with access to `charukun/soul-lineage`.
2. Open **Work** and create an event-triggered task for GitHub pull request activity.
3. Trigger: **pull request opened** in `charukun/soul-lineage`.
4. Condition: continue only when the PR is Draft, base is `develop`, head branch starts with `dispatch/`, head is from `charukun/soul-lineage`, and the body contains `RINNE-Dispatch: implementation` plus a non-empty `## Request` section.
5. Use the Work prompt below.
6. Review Trigger / Condition / Prompt and complete the required GitHub authorization.
7. Manage the task from Scheduled/Tasks. If an external action requires approval, the Work task may pause until that approval is granted.

Project-uploaded files are not required by this route. The task must re-read the repository every run because GitHub is the source of truth.

## Work task prompt

```text
Repository: charukun/soul-lineage

You are the implementation worker for the GitHub pull request that triggered this task.

First verify that the PR is still open, Draft, targets develop, comes from the same repository, its head starts with dispatch/, and its body contains `RINNE-Dispatch: implementation` plus a non-empty `## Request`. If not, stop without changing anything.

Use the repository as the source of truth. Read current develop, AGENTS.md, docs/DEVELOPMENT.md, docs/INTEGRATION.md, docs/RINNE_PROJECT_EXECUTION_POLICY.md, docs/DISPATCHER.md and relevant app/package documentation before editing.

Work on the existing dispatch branch and existing Draft PR. Do not create another branch or PR. Reconcile with latest develop before substantive changes. Implement only the `## Request` scope. Do not modify main or Production. Do not weaken tests, browser assertions, review requirements, Integration rules or repository protections.

Use the existing repository write-route policy: normal git first when available, then connected GitHub actions/API, then Codespaces + normal git if required. Keep the same branch and PR as the recovery point.

For code changes, perform the required affected fast verification, including `npm ci` and `node scripts/validate.mjs fast origin/develop HEAD` when applicable. Commit and push to the same dispatch branch. Update the existing PR with the result, exact commit SHA and checks actually run, remove the transient `.task-start` marker, then mark that PR Ready for review.

After Ready, record `READY_FOR_INTEGRATION` and stop. Do not synchronously wait for CI, browser verification, merge or DEV publication. Existing Integration owns that path.

If the request is already satisfied and no substantive diff is needed, comment that result and close the Draft PR without merge.

If work cannot be completed, keep the PR Draft and comment: reached stage, branch/commit SHA, failure reason, GitHub routes tried, and next recovery route. Do not silently fall back to OpenAI Platform API billing.
```

## Completion behavior

When substantive changes exist, the Work task owns implementation through Ready for review:

1. reconcile with latest develop;
2. implement only the request;
3. remove the transient `.task-start` marker;
4. run affected fast verification;
5. commit and push the same dispatch branch;
6. update the existing PR with exact result/SHA;
7. mark the PR Ready for review;
8. record `READY_FOR_INTEGRATION` and stop without polling CI.

Existing Integration then owns CI monitoring, develop merge, DEV deploy and public/browser verification. The immediate Ready handoff recorder introduced by the repository delivery policy is a durable receipt only; it is not a reason for the implementation worker to wait.

If there is no substantive implementation change, close the Draft PR without merge rather than manufacturing a meaningless change.

## Failure and recovery

A failed or paused Work task must leave the same Draft PR and branch as the recovery point. Record the reached stage, head SHA, failure reason, routes tried and next route in a PR comment when possible.

If ChatGPT Work is unavailable, its GitHub permission requires approval, or its event task is paused, do **not** fall back automatically to the paid OpenAI Platform API. Continue from the same Draft PR in a normal Chat/WORK session or restore the Work event task.

## Retired paid route

The first prototype used `openai/codex-action` from GitHub Actions with `OPENAI_API_KEY`. The end-to-end smoke test reached the Codex worker but stopped because Platform API credits were unavailable. That route is retired for normal RINNE Dispatch operation.

The repository may still contain historical PR/comments referring to `OPENAI_API_KEY`; they are migration history, not the current dispatch contract. Do not remove the repository secret solely for Dispatcher cleanup while another workflow still references it.

## Acceptance criteria

- Opening an eligible same-repository `dispatch/*` Draft PR records a no-cost GitHub handoff and never invokes `openai/codex-action`.
- No dispatch GitHub Action references or consumes `OPENAI_API_KEY`.
- A configured ChatGPT Work GitHub PR event task can implement on the existing branch/PR and hand the result to Ready for review.
- The Work task follows the repository no-wait boundary and ends at `READY_FOR_INTEGRATION`.
- No-op work closes Draft without merge.
- Failure preserves the Draft PR/branch recovery point.
- Existing Ready -> Integration -> develop -> DEV remains unchanged.
- No new task database, second Integration queue, main change or Production change is introduced.
