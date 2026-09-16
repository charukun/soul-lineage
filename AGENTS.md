# soul-lineage development

This repository contains 輪廻転焦, village housing, and demon-army apps. `develop` is the implementation source of truth; `main` is Production.

## Start here

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file, then use [`docs/README.md`](docs/README.md) to select the canonical document for the task.
3. When a checkout is available, run `npm run context:plan -- --task "<short task summary>"` and read only the returned documents that are actually needed.
4. Keep retrieval lean per [`docs/CONTEXT_EFFICIENCY.md`](docs/CONTEXT_EFFICIENCY.md). Do not preload past chats, all docs, merged PR history, whole large diffs, or all CI logs.

Use metadata → changed filenames / failed job → necessary patch / range. CI log retrieval is capped by the shared context ledger. On budget exhaustion, summarize the evidence and hand off instead of mining more logs or polling.

## Delivery boundary

Normal implementation work follows [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md): latest `develop` → work branch / Draft PR → implementation → fast validation → push → Ready for review → `READY_FOR_INTEGRATION` → final response.

Ready ends the implementation session. Running / Queued / Pending CI, browser checks, handoff recorder, Integration, and DEV publication must not keep the worker alive. Do not watch, sleep, or poll for completion. Integration owns asynchronous merge/publication/repair. The detailed boundary is canonical in [`docs/RINNE_PROJECT_EXECUTION_POLICY.md`](docs/RINNE_PROJECT_EXECUTION_POLICY.md); do not fetch the full policy unconditionally when the summary here and the task-specific document are sufficient.

Use normal git first, then the connected GitHub API, then the same branch in existing GitHub Codespaces when transport or binary limits require it. One failed route is not task failure. Large binaries must not be split/Base64-retried through the connector. See [`docs/MOBILE_HYBRID_DEVELOPMENT.md`](docs/MOBILE_HYBRID_DEVELOPMENT.md).

For user-requested work in `charukun/soul-lineage`, transfer of project code/assets to this repository or its existing Codespaces, work-branch push, PR create/update, and explicitly requested Lab publication are already authorized within the limits recorded in [`docs/DELIVERY_AUTHORIZATION.md`](docs/DELIVERY_AUTHORIZATION.md). Do not ask the same permission again. This does not authorize unrelated data, new paid resources, credential/security changes, destructive operations, develop merge by an implementation worker, or main/Production publication.

Never modify `main` or Production unless the user explicitly requests it. Never weaken tests, browser assertions, review requirements, exact-head gates, repair attempt limits, or Production gates to make a change pass.

## Architecture invariants

- Keep each game under `apps/<id>` and shared code under `packages/<id>`. Apps must not import other apps; packages must not import apps. See [`docs/MONOREPO.md`](docs/MONOREPO.md).
- Game/domain logic uses injected platform ports. Browser APIs, SDK calls, renderer/UI bootstrap, and device storage belong in adapters/bootstrap. See [`docs/PLATFORMS.md`](docs/PLATFORMS.md).
- Tidebreak integration belongs to `apps/rinne`; do not recreate a root-level game.
- Source bloat and structural debt follow [`docs/CODE_HEALTH.md`](docs/CODE_HEALTH.md). Fast validation may reject new regressions without retroactively blocking existing hotspots.
- Validate affected apps/shared packages. Deployment/control-plane changes also require their dedicated infrastructure checks. Production quality requirements are unchanged.

## Task routing

Read only the rows that match the task.

| Task | Canonical / specialist document |
| --- | --- |
| Routine implementation | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) |
| Integration / merge / DEV publication | [`docs/INTEGRATION.md`](docs/INTEGRATION.md) |
| Integration control-plane reconciliation | [`docs/INTEGRATION_RECONCILIATION.md`](docs/INTEGRATION_RECONCILIATION.md) |
| Fast Repair / legacy Rescue compatibility | [`docs/INTEGRATION_RESCUE.md`](docs/INTEGRATION_RESCUE.md) |
| Browser repair | [`docs/BROWSER_SELF_HEALING.md`](docs/BROWSER_SELF_HEALING.md) |
| User explicitly asks to play/operate/verify in a browser | [`docs/BROWSER_PLAYTEST_ROUTING.md`](docs/BROWSER_PLAYTEST_ROUTING.md) |
| Dispatch to a dedicated worker | [`docs/DISPATCHER.md`](docs/DISPATCHER.md) |
| Mobile / Codespaces / push routing | [`docs/MOBILE_HYBRID_DEVELOPMENT.md`](docs/MOBILE_HYBRID_DEVELOPMENT.md) |
| Character/model/rig/material/DCC work | [`docs/art/README.md`](docs/art/README.md) and the routed `docs/characters/` contract |
| Character motion / stance / locomotion | [`docs/characters/MOTION_AUTHORING.md`](docs/characters/MOTION_AUTHORING.md) and [`docs/characters/MOTION_QUALITY.md`](docs/characters/MOTION_QUALITY.md) |

## Specialized execution

Character production must follow [`docs/characters/CHARACTER_PRODUCTION_PIPELINE.md`](docs/characters/CHARACTER_PRODUCTION_PIPELINE.md). Runtime primitive/procedural geometry is `BLOCKOUT` only; production-ready stages require reviewed DCC/imported assets, provenance, deformation/Motion QA, runtime evidence, and explicit visual approval where the character contract requires it.

When a requested Blender character build needs repository-hosted headless execution, follow [`docs/characters/CHARACTER_DCC_CARRIER.md`](docs/characters/CHARACTER_DCC_CARRIER.md): use a short-lived `dcc/<slug>` branch and the carrier contract. Do not repurpose RINNE Dispatch merely to obtain Blender, and do not wait/poll for the carrier.

When the user explicitly requests a dedicated worker (`派生して`, `別セッションで`, etc.), use RINNE Dispatch only for a self-contained implementation task. Bootstrap the Draft PR and request marker as described in [`docs/DISPATCHER.md`](docs/DISPATCHER.md); the dispatched worker implements and returns the same PR to normal Integration.

Visual/motion review observes current `develop`; it is not a second source of gameplay or motion truth. Preserve native gameplay/contact timing and shared sources. Use the current review routes documented by the character/motion guides rather than reviving a long-lived review branch.
