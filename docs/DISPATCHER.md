# RINNE Dispatcher

RINNE Dispatcher is a thin control-plane entry point for turning one natural-language instruction into the appropriate existing execution route without replacing GitHub as the source of truth.

## Scope

The dispatcher may start an implementation worker for a self-contained code task. It does not introduce a separate task database, custom task ID state machine, or a second Integration queue. Existing GitHub branch / Draft PR / Ready / merged state remains authoritative, and existing `Depends-On`, Integration, browser repair, PULSE, heartbeat and notification flows remain in force.

The first implementation route is an OpenAI managed Agent Session created through an authenticated PULSE API endpoint. The spawned worker must operate on `charukun/soul-lineage` and follow the current `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/INTEGRATION.md`, and repository-local policies at execution time.

## Dispatch contract

`POST /api/dispatch`

Request body:

```json
{
  "instruction": "Visual Review Labの描画領域を7割にする",
  "mode": "implementation"
}
```

`mode` is optional and defaults to `implementation` in the first release. The dispatcher intentionally does not create a second automatic Integration worker. Ready PR processing continues through the repository's existing Integration workflow.

A successful request creates a managed Agent Session and returns the OpenAI session identifier and status. That session identifier is transport metadata only. Recovery and completion are determined from the worker's GitHub branch, Draft/Ready PR, commit and existing Integration state, not from the session identifier.

## Spawned implementation worker rules

The generated worker instruction requires all of the following:

1. Re-fetch latest `develop`, `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/INTEGRATION.md` and relevant repository policy before editing.
2. Use latest `develop` as the implementation base.
3. Create and push a dedicated branch and develop-targeting Draft PR before code edits, following the PR body contract.
4. Implement only the requested scope and preserve app/package boundaries.
5. Run the minimum affected fast verification required by repository policy.
6. Commit and push, update the PR with actual verification, mark it Ready for review, then stop without synchronously waiting for CI/merge/DEV.
7. Never modify `main` or Production unless an explicit future request authorizes it.
8. Do not weaken tests, browser assertions, review requirements, Integration rules or repository protections to make the task pass.
9. Do not create sub-agents for normal implementation work.

## Authentication and secrets

The dispatch endpoint is disabled unless all required secrets/configuration are present. Secrets are Worker-side only and must never be returned to the browser or embedded in static assets.

Required runtime values:

- `RINNE_DISPATCH_TOKEN`: bearer token required by `/api/dispatch` and private session-status endpoints.
- `OPENAI_API_KEY`: OpenAI API credential used only by the Worker.
- `RINNE_AGENT_ENVIRONMENT_TEMPLATE_ID`: reusable OpenAI-hosted environment template that contains the repository execution setup.

Optional runtime values:

- `RINNE_AGENT_MODEL`: model used for spawned sessions. The Worker keeps this configurable instead of baking policy to a particular model release.

The reusable environment template is expected to provide normal `git` access to the repository and the credentials required for branch/PR operations. GitHub credentials belong in the confidential environment template, not in the dispatch request or response.

## Failure behavior

Authentication failures return `401`. Invalid instructions return `400`. Missing server configuration returns `503` with only the names of missing configuration values. OpenAI API failures return a sanitized upstream error and do not expose credentials or confidential environment contents.

If worker execution later fails, recovery follows the repository's existing branch / commit / PR / handoff / CI state. The dispatcher does not attempt to infer completion from ChatGPT app notifications and does not replace the existing external SUCCESS / FAILED notification path.

## Acceptance criteria for the first release

- Authenticated `POST /api/dispatch` creates a managed Agent Session with initial implementation instructions.
- `GET /api/dispatch/sessions/:id` can retrieve the private upstream session state for diagnostics.
- Unauthorized callers cannot start or inspect sessions.
- Missing secrets fail closed.
- Unit tests cover request validation, authorization, session body construction and upstream failure sanitization.
- Existing PULSE state/read APIs and Integration behavior remain unchanged.
