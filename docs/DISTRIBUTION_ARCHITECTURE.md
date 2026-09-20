# Distribution Architecture

This document defines the distribution boundary for the three game apps and future consumer targets.

## Goal

One source app must be able to produce independent immutable artifacts for multiple targets without coupling DEV speed to Production or future store packaging.

The canonical shape is:

```text
app source
  -> affected dependency graph
  -> target build
  -> immutable artifact
  -> target-specific publisher / packager
```

The game apps are `rinne`, `village`, and `demon`. `review` and `character-studio` are separate developer-facing DEV tools and are not children of `rinne`. A change in one app must not force unrelated app builds. A shared-package change fans out only to apps whose workspace dependency closure includes that package.

## Target classes

| Target | Current status | Source branch | Purpose |
| --- | --- | --- | --- |
| `web-dev` | implemented | `develop` | fastest human review / device check |
| `web-prod` | existing release path | `main` | current browser Production |
| `steam` | contract only | release candidate | future Steam package |
| `android` | contract only | release candidate | future Android package |
| `ios` | contract only | release candidate | future iOS package |
| `playstation` | contract only | release candidate | future PlayStation package |
| `switch` | contract only | release candidate | future Nintendo package |
| `xbox` | contract only | release candidate | future Xbox package |

A target marked contract-only must fail explicitly if asked to produce a release artifact. Do not emulate store packaging or claim readiness without the SDK/toolchain and platform adapter.

## Immutable artifact contract

Every target build has a stable identity:

```text
<app>/<target>/<source-sha>/
```

and carries an `artifact.json` receipt containing at least:

- schema version;
- app;
- target;
- source SHA;
- source branch;
- input hash;
- build timestamp;
- package/display name;
- artifact format;
- entry path when applicable;
- platform capability state.

A publisher consumes an artifact. It must not rebuild game source.

## DEV publication contract

DEV is app-scoped and latest-wins per app.

A `demon` change may publish `demon` while `rinne` or `village` work is in flight. A later `demon` source supersedes an older pending `demon` publication, but unrelated app publication must not be cancelled because another app advanced.

Primary Web DEV publication is app-scoped Cloudflare Workers static assets. For autonomous gameplay observation, each published Worker version also exposes an immutable version preview URL. This preview is the staging observation surface: it serves the exact published app bytes without moving when a later DEV deployment replaces the latest URL. The staging role is observational; the artifact remains the same `web-dev` build and therefore keeps `environment=dev` in `version.json`.

For `village` and `demon`, preview URLs are explicitly enabled in their Wrangler configs. Given a Wrangler `Current Version ID`, the preview host uses the first eight hex characters as the version prefix. `scripts/staging-preview.mjs` turns the exact source SHA plus Worker version ID into the canonical `immutable-staging` observation reference. Before/After observation must verify `version.json.commit` against the recorded source SHA.

Primary Web DEV publication is app-scoped Cloudflare Workers static assets:

- `rinne`: `https://soul-lineage-rinne-dev.c-okamoto.workers.dev/`
- `village`: `https://soul-lineage-village-dev.c-okamoto.workers.dev/`
- `demon`: `https://soul-lineage-demon-dev.c-okamoto.workers.dev/`
- `review`: `https://soul-lineage-review-dev.c-okamoto.workers.dev/`
- `character-studio`: `https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/`

GitHub Pages is not a DEV publisher. The legacy `/dev/` mirror is retired and Pages remains the Production/staging compatibility surface. Each Workers app job has its own concurrency key, so a newer app change may supersede an older publication of the same app without cancelling unrelated app publication. PULSE remains an independent control-plane Worker at `https://rinne-ops.c-okamoto.workers.dev/`.

After all apps affected by one develop merge are successfully published to their independent DEV URLs, one GitHub PR receipt is created. Public exact-source checks remain diagnostic evidence and do not block DEV completion or the receipt. The legacy Pages publisher must not be required for that notification.

## Consumer packaging contract

Consumer packaging starts from the same portable game source but is a different target pipeline from `web-dev`.

Target adapters and packaging may own:

- storefront identity and entitlement;
- controller mapping;
- native lifecycle;
- cloud save;
- achievements;
- commerce;
- platform authentication;
- native asset conversion;
- signing/notarization;
- certification metadata.

These concerns must not leak into game/domain logic.

## Release safety

- `main` and Production remain unchanged unless explicitly authorized.
- Web DEV speed must not weaken Production/store quality gates.
- Contract-only targets remain unavailable until their adapter/toolchain is materialized.
- Target artifacts are immutable; promotion changes a pointer/release reference rather than mutating an old artifact.
- Cross-play and cloud-save capability claims remain false until backed by real adapters/services.


## Implemented pipeline

The repository now exposes:

- `npm run distribution:plan` for dependency-aware affected app planning;
- `npm run distribution:build -- --app <app> --target <target>` for immutable target artifacts;
- `.github/workflows/dev-app-publish.yml` for independent affected-app DEV publication plus PULSE refresh;
- `.github/workflows/distribution-artifact.yml` for explicit/reusable artifact production;
- app-scoped `dev/<app>` commit statuses;
- non-blocking public source diagnostics through `version.json`;
- immutable Cloudflare Worker version-preview staging references for `village` and `demon`, derived by `scripts/staging-preview.mjs`;
- one fast DEV completion receipt after every affected app for that merge is live.

`deploy.yml` is Production-only. A one-shot retirement workflow removes the former Pages `/dev/` mirror while preserving existing non-DEV release bytes.
