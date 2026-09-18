# soul-lineage development

This repository contains 輪廻転焦, village housing, and demon-army apps. `develop` is the implementation source of truth; `main` is Production.

## Start here

1. Confirm the latest `develop` SHA and current GitHub state.
2. Read this file, then use [`docs/README.md`](docs/README.md) to select the canonical document for the task.
3. When a checkout is available, run `npm run context:plan -- --task "<short task summary>"` and read only the returned documents that are actually needed.
4. Keep retrieval lean per [`docs/CONTEXT_EFFICIENCY.md`](docs/CONTEXT_EFFICIENCY.md). Do not preload past chats, all docs, merged PR history, whole large diffs, or all CI logs.

Use metadata → changed filenames / failed job → necessary patch / range. CI log retrieval is capped by the shared context ledger: stop after 3 unique excerpts or 96 KiB total, and do not switch ranges/jobs to evade that limit. On budget exhaustion, summarize the evidence and hand off instead of mining more logs or polling.

## Delivery boundary

Normal implementation work follows [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md): latest `develop` → work branch / Draft PR → implementation → focused validation → **merge-forward current `develop` into the work branch** → focused revalidation → push → final develop freshness verify → Ready for review → same-task merge to `develop` → asynchronous DEV publication.

A qualifying micro patch follows [`docs/MICRO_PATCH_FAST_LANE.md`](docs/MICRO_PATCH_FAST_LANE.md), but uses the same pre-Ready freshness rule: latest `develop` → short-lived branch → small implementation → affected focused validation → current develop merge-forward / revalidation → push → final freshness verify → **Ready PR directly** → same-task merge to `develop`. Do not create a Draft PR or start Draft CI just to carry a tiny safe edit. If the patch touches control-plane, shared contracts, dependencies, schema/save/protocol, auth/security, infrastructure, generated/binary assets, or otherwise falls outside that contract, use the normal Draft route.

With a checkout, use `npm run pre-ready:sync` before the final validation/push and `npm run pre-ready:verify` immediately before Ready. If develop advanced again, repeat sync → focused validation → push → verify. True conflicts are resolved by the implementation worker using both the current develop contract and the task intent; never select ours/theirs blindly or weaken quality gates. Without a checkout, the connected GitHub/API route must produce the same reconciled work-branch ancestry before Ready.

After focused validation and final develop freshness verification, the same task worker marks the PR Ready and merges it to `develop` using the exact current PR head. No develop PR CI, merge queue, Ready handoff, or automatic repair loop exists. DEV publication starts from the resulting `develop` push. The detailed boundary and mandatory screenshot/video presentation in completion reports are canonical in [`docs/RINNE_PROJECT_EXECUTION_POLICY.md`](docs/RINNE_PROJECT_EXECUTION_POLICY.md); do not fetch the full policy unconditionally. Read the relevant evidence section for final delivery.

Use normal git first, then the connected GitHub API, then the same branch in existing GitHub Codespaces when transport or binary limits require it. One failed route is not task failure. Large binaries must not be split/Base64-retried through the connector. See [`docs/MOBILE_HYBRID_DEVELOPMENT.md`](docs/MOBILE_HYBRID_DEVELOPMENT.md).

For user-requested work in `charukun/soul-lineage`, transfer of project code/assets to this repository or its existing Codespaces, work-branch push, PR create/update, pre-Ready merge-forward of current `develop` **into the work branch**, and explicitly requested Lab publication are already authorized within the limits recorded in [`docs/DELIVERY_AUTHORIZATION.md`](docs/DELIVERY_AUTHORIZATION.md). Do not ask the same permission again. This does not authorize unrelated data, new paid resources, credential/security changes, destructive operations, unguarded direct pushes to `develop`, or main/Production publication. For this personal AI-development repository, the same-task worker may merge its PR into `develop` after focused validation, hold/dependency checks, current-develop reconciliation and final freshness verification pass.

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
| Qualifying tiny/safe code edit | [`docs/MICRO_PATCH_FAST_LANE.md`](docs/MICRO_PATCH_FAST_LANE.md) |
| develop merge / DEV publication | [`docs/DEVELOP_MERGE.md`](docs/DEVELOP_MERGE.md) |
| legacy merge-control reconciliation | [`docs/INTEGRATION_RECONCILIATION.md`](docs/INTEGRATION_RECONCILIATION.md) |
| Fast Repair / legacy Rescue compatibility | [`docs/INTEGRATION_RESCUE.md`](docs/INTEGRATION_RESCUE.md) |
| Browser repair | [`docs/BROWSER_SELF_HEALING.md`](docs/BROWSER_SELF_HEALING.md) |
| User explicitly asks to play/operate/verify in a browser | [`docs/BROWSER_PLAYTEST_ROUTING.md`](docs/BROWSER_PLAYTEST_ROUTING.md) |
| Dispatch to a dedicated worker | [`docs/DISPATCHER.md`](docs/DISPATCHER.md) |
| Mobile / Codespaces / push routing | [`docs/MOBILE_HYBRID_DEVELOPMENT.md`](docs/MOBILE_HYBRID_DEVELOPMENT.md) |
| Character/model/rig/material/DCC work | [`docs/art/README.md`](docs/art/README.md) and the routed `docs/characters/` contract |
| Character motion / stance / locomotion | [`docs/characters/MOTION_AUTHORING.md`](docs/characters/MOTION_AUTHORING.md) and [`docs/characters/MOTION_QUALITY.md`](docs/characters/MOTION_QUALITY.md) |
| User asks for the current motion video (`動画ください`) | [`docs/characters/MOTION_VIDEO_HANDOFF.md`](docs/characters/MOTION_VIDEO_HANDOFF.md) |

## Specialized execution

Character production must follow [`docs/characters/CHARACTER_PRODUCTION_PIPELINE.md`](docs/characters/CHARACTER_PRODUCTION_PIPELINE.md). Runtime primitive/procedural geometry is `BLOCKOUT` only; production-ready stages require reviewed DCC/imported assets, provenance, deformation/Motion QA, runtime evidence, and explicit visual approval where the character contract requires it.

When a requested Blender character build needs repository-hosted headless execution, follow [`docs/characters/CHARACTER_DCC_CARRIER.md`](docs/characters/CHARACTER_DCC_CARRIER.md): use a short-lived `dcc/<slug>` branch and the carrier contract. Do not repurpose RINNE Dispatch merely to obtain Blender, and do not wait/poll for the carrier.

When the user explicitly requests a dedicated worker (`派生して`, `別セッションで`, etc.), use RINNE Dispatch only for a self-contained implementation task. Bootstrap the Draft PR and request marker as described in [`docs/DISPATCHER.md`](docs/DISPATCHER.md); the dispatched worker implements, validates, reconciles current develop, marks the PR Ready and merges the same PR.

When the user asks for a motion video, do not synthesize a stick figure or schematic as a substitute. Resolve the target PR's current exact head and use the corresponding `pr-browser-<pr>-<head>` artifact described by [`docs/characters/MOTION_VIDEO_HANDOFF.md`](docs/characters/MOTION_VIDEO_HANDOFF.md). Only call it an actual motion video when the receipt identifies the real model/runtime and exact head.

Visual/motion review observes current `develop`; it is not a second source of gameplay or motion truth. Preserve native gameplay/contact timing and shared sources. Use the current review routes documented by the character/motion guides rather than reviving a long-lived review branch.
