# soul-lineage development

This repository contains 輪廻転焦 (formerly 魂の系譜), village housing, and demon-army apps.

- Read README.md and docs/MONOREPO.md before build/deployment changes; read docs/PLATFORMS.md for gameplay/platform work.
- The latest develop is the implementation base. Keep each game's entry point under apps/<id>; do not recreate a single root game.
- Tidebreak integration belongs to apps/rinne. Reconcile parallel work against current develop; preserve app/package boundaries and selective deployment.
- Shared code belongs to packages with explicit workspace dependencies. Apps must not import one another. Packages must not import apps.
- Game/domain logic must use injected platform ports. Browser APIs, SDK calls, renderer/UI setup and device storage belong in adapters/bootstrap.
- Keep production source on main. Reuse existing GitHub Pages/OIDC infrastructure, retain unchanged app artifacts, and do not silently promote develop game code to production.
- Validate affected apps and shared packages. Deployment changes also require infrastructure tests and public URL verification.
