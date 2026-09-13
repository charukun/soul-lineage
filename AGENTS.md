# soul-lineage development

This repository contains 輪廻転焦 (formerly 魂の系譜), village housing, and demon-army apps.

- Read README.md and docs/MONOREPO.md before build/deployment changes; read docs/PLATFORMS.md for gameplay/platform work.
- The latest develop is the implementation base. Keep each game's entry point under apps/<id>; do not recreate a single root game.
- Tidebreak integration belongs to apps/rinne. Reconcile parallel work against current develop; preserve app/package boundaries and selective deployment.
- Shared code belongs to packages with explicit workspace dependencies. Apps must not import one another. Packages must not import apps.
- Game/domain logic must use injected platform ports. Browser APIs, SDK calls, renderer/UI setup and device storage belong in adapters/bootstrap.
- Keep production source on main. Reuse existing GitHub Pages/OIDC infrastructure, retain unchanged app artifacts, and do not silently promote develop game code to production.
- Validate affected apps and shared packages. Deployment changes also require infrastructure tests and public URL verification.
- For smartphone-only development, follow `docs/MOBILE_HYBRID_DEVELOPMENT.md`: normal git from Chat/WORK/Codex is the first route, then the connected GitHub API; when connector transport cannot handle changed files, switch the same work branch to GitHub Codespaces and normal `git push`. Do not split/Base64-retry large binaries through the connector.
- Browser verification failures follow `docs/BROWSER_SELF_HEALING.md`. End-to-end repair verification is not complete until the relevant browser gate succeeds; Integration owns that asynchronous verification, not a waiting implementation worker. Claim machine-readable repair tickets before editing code, never create parallel repairs for the same ticket, and stop automation at the configured attempt limit instead of weakening assertions.

## WORK roles (current operation)

- Read `docs/DEVELOPMENT.md` and `docs/INTEGRATION.md` for the current delivery flow.
- For normal code-changing tasks, push a work branch and open a Draft PR before code edits; follow the first-two-body-lines, lightweight Draft CI and recovery contract in `docs/DEVELOPMENT.md`. Read-only and writing-only tasks are exempt.
- Mandatory delivery boundary: read `docs/RINNE_PROJECT_EXECUTION_POLICY.md`. Implementation WORK ends at Ready for review → `READY_FOR_INTEGRATION` handoff → final response. Running / Queued / Pending CI or browser checks must never keep the session alive; no watch, sleep/polling or repeated completion checks. Integration owns asynchronous monitoring and repair. Explicitly assigned Integration work retains its separate responsibility.
- Integration owns dependency/review/check/conflict decisions, develop merges, affected fast verification, DEV deployment and public HTTP/source verification. Focused affected browser verification is a delivery gate; heavy full regression and P2P checks remain separate opt-in diagnostics. Never equate Ready with DEV publication; preserve Production quality gates.
- Keep PRs focused. State changed apps/packages, checks actually run, shared impacts and `Depends-On: #N` (or `none`). Use draft or `integration:hold` for unfinished work/undecided semantics. Never clear holds or resolve review objections to make automation proceed.
- Automation/control changes require Integration review of the exact head; no policy/protection bypass. Normal work uses no sub-agents.
- Do not modify main or Production as part of develop Integration. Explicit user scope supersedes older handoff instructions that assign merge/deploy to every WORK.

## RINNE Dispatch

- Read `docs/DISPATCHER.md` before using or modifying the dispatch route.
- When the user explicitly says `派生して`, `別セッションで`, or otherwise asks to hand a self-contained implementation task to a dedicated worker, the initiating Chat/WORK may bootstrap a RINNE Dispatch instead of implementing the code itself.
- Dispatch is for tasks that can complete without repeated human visual/semantic decisions. Ambiguous specifications, large visual iteration, and work requiring ongoing user feedback stay in normal Chat/WORK.
- Bootstrap from the current latest `develop`: create `dispatch/<short-slug>`, add a temporary `.task-start/<short-slug>.md` scope marker as the meaningful initial diff, and open a develop-targeting Draft PR. Its first two body lines follow the normal PR contract, followed by `RINNE-Dispatch: implementation` and a non-empty `## Request` section. Do not make the requested implementation edits during bootstrap.
- The repository `RINNE Dispatch Handoff` workflow only validates the Draft PR contract and records the handoff. It must not invoke `openai/codex-action`, use `OPENAI_API_KEY`, or silently fall back to paid OpenAI Platform API credits.
- A configured ChatGPT Work GitHub pull-request event task owns implementation on the same `dispatch/*` branch and Draft PR. It re-reads current Repository policy, reconciles with latest develop, implements the `## Request`, runs affected fast verification, commits/pushes, updates the existing PR and marks it Ready. If no substantive change is required it closes the Draft without merge; on failure it leaves the same Draft PR/branch as the recovery point.
- The Work task is also bound by `docs/RINNE_PROJECT_EXECUTION_POLICY.md`: after push + Ready it records `READY_FOR_INTEGRATION` and ends without waiting for CI/browser completion. Integration remains the monitoring and delivery owner.
- If the Work task is unavailable, paused, or waiting for connected-app approval, continue from the same Draft PR in a normal Chat/WORK session or repair that task. Do not automatically switch to a billed API-key route.
- After the dispatch PR becomes Ready, the existing Integration flow owns CI, merge and DEV publication exactly as for any other Ready PR.
