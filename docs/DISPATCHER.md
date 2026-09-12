# RINNE Dispatcher

RINNE Dispatcher turns one natural-language instruction into an isolated implementation worker while keeping GitHub, not a Chat/agent session, as the source of truth.

## Why this route

The repository already has an event-driven Integration path for Ready PRs. Dispatcher therefore does **not** create a second Integration worker, a custom task database, or a task-ID state machine. It fills only the missing front half: creating a dedicated implementation work item from a short instruction.

The first release uses a normal GitHub Draft PR as the work record and the official OpenAI Codex GitHub Action as the isolated implementation worker. This avoids requiring a ChatGPT-project child-chat API and gives the worker a checked-out repository while preserving the existing Draft → Ready → Integration lifecycle.

## User-facing command

A project Chat may treat requests such as these as dispatch requests when the work is self-contained and can run without iterative human visual/semantic direction:

- `派生して。Villageの初回建築導線を改善`
- `別セッションで。faviconの不具合を直して`
- `この小修正を並列で進めて`

Interactive design work, ambiguous specification work, large visual iteration, and tasks that need repeated human feedback remain normal Chat / WORK sessions.

## Bootstrap contract

For an implementation dispatch, the initiating Chat/WORK performs only the bootstrap below. It does not implement the requested code itself.

1. Re-read latest `develop`, `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/INTEGRATION.md`, and relevant policies.
2. Create `dispatch/<short-slug>` from the current latest `develop`.
3. Add one temporary `.task-start/<short-slug>.md` marker containing the requested scope and bootstrap/recovery information. This is only the meaningful initial diff needed to create the Draft PR and is removed before a successful Ready transition.
4. Open a develop-targeting **Draft PR** whose body begins with the normal two-line contract and contains:

```text
RINNE-Dispatch: implementation

## Request
<the implementation request>
```

5. Stop the bootstrap role. The `RINNE Dispatch` GitHub workflow starts from the `pull_request.opened` event.

No separate task identifier is created. The branch, Draft PR, head SHA, workflow run, and later Ready PR are the recovery coordinates.

## Eligibility and trust boundary

The workflow runs the implementation worker only when all of these conditions are true:

- PR is Draft.
- base is `develop`.
- head belongs to the same repository.
- head branch starts with `dispatch/`.
- author association is `OWNER`, `MEMBER`, or `COLLABORATOR`.
- PR body contains `RINNE-Dispatch: implementation` and a non-empty `## Request` section.

The workflow deliberately uses `pull_request`, not `pull_request_target`. Forked/untrusted PR content is not granted the OpenAI credential. The Codex Action itself also enforces repository write-access checks.

## Worker isolation

`openai/codex-action` is pinned to an exact commit and runs with:

- a workspace-limited permission profile,
- `drop-sudo` safety strategy,
- checkout credentials not persisted into the worker workspace,
- the OpenAI API key supplied only to the action's secure proxy path.

The generated prompt places repository delivery/safety rules above the user request. The worker is told to edit the working tree only. It must not create another branch/PR, push, mark Ready, merge, touch main/Production, spawn sub-agents, or weaken validation.

The workflow wrapper owns commit, push, result recording, and Ready transition.

## Completion behavior

When substantive changes exist:

1. Remove the transient `.task-start` marker from the final diff.
2. Commit the implementation locally.
3. Run `npm ci`.
4. Run `node scripts/validate.mjs fast origin/develop HEAD`.
5. Push the same dispatch branch.
6. Record the exact commit and fast verification in the PR.
7. Record `dispatch/implementation=success` on the exact head.
8. Mark the PR Ready for review and stop.

Existing Integration then owns CI monitoring, merge, DEV deploy and public/browser verification. Dispatcher never polls CI waiting for completion.

If the worker finds the request already satisfied and produces no substantive diff, the Draft PR is commented and closed without merge rather than manufacturing a meaningless change.

## Failure and recovery

On a failed Codex/validation run, the workflow keeps the PR Draft. Any recoverable local changes are committed/pushed as WIP when possible, a failure commit status is written, and the PR comment records:

- failed route,
- branch,
- commit,
- workflow/log URL,
- normal-git / connected GitHub API / Codespaces recovery route.

Recovery starts from that same Draft PR and branch. The dispatcher does not create a replacement task or infer success from ChatGPT application notifications.

## Secrets and configuration

Required GitHub Actions secret:

- `OPENAI_API_KEY`: credential used by the official Codex Action.

Optional repository variable:

- `RINNE_CODEX_MODEL`: explicit Codex model override. If empty, the action/CLI default model is used.

The standard GitHub Actions token is used only by wrapper steps after the Codex worker finishes to push and update the PR. Checkout uses `persist-credentials: false`, so the implementation worker does not receive persisted repository credentials through the working tree.

## First-release acceptance criteria

- A properly formed same-repository Draft PR on `dispatch/*` starts exactly one implementation workflow on open.
- Invalid/fork/non-Draft dispatch attempts do not run the worker.
- The worker receives only the `## Request` scope beneath repository safety instructions.
- Successful work is fast-validated, pushed on the same branch, and made Ready for existing Integration.
- Failed work stays Draft and leaves a GitHub recovery point.
- No independent Integration queue, task database, Task-ID state machine, main change, or Production change is introduced.
