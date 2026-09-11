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

## WORK roles (current operation)

- Read `docs/DEVELOPMENT.md` and `docs/INTEGRATION.md` for the current delivery flow.
- Implementation WORK ends at implementation, affected fast verification and a Ready for review PR to develop. It does not merge, run the heavy full regression, or wait for DEV publication unless the user explicitly assigns Integration work.
- Integration owns dependency/review/check/conflict decisions, develop merges, affected fast verification, DEV deployment and public HTTP/source verification. Never equate Ready with DEV publication. Heavy full regression, browser and P2P checks are separate opt-in diagnostics; preserve Production quality gates.
- Keep PRs focused. State changed apps/packages, checks actually run, shared impacts and `Depends-On: #N` (or `none`). Use draft or `integration:hold` for unfinished work/undecided semantics. Never clear holds or resolve review objections to make automation proceed.
- Automation/control changes require Integration review of the exact head; no policy/protection bypass. Normal work uses no sub-agents.
- Do not modify main or Production as part of develop Integration. Explicit user scope supersedes older handoff instructions that assign merge/deploy to every WORK.
